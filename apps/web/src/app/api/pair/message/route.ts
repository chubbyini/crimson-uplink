import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { loadSettings } from "@/lib/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkDailyLlmCap, recordLlmUsage } from "@/lib/usage";
import { assertDocId } from "@/lib/validation";
import { pairTurn, needsSummary, compactHistory, type ForcedMode } from "@/lib/pair/chat";
import {
  getSession,
  sessionRef,
  activeArticle,
  shipArticles,
} from "@/lib/pair/sessions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MSG = 4000;

/**
 * POST /api/pair/message — one pair turn (free chat or /command).
 * Body: { sessionId: string, text: string }.
 * Commands: /rewrite /critique [deep|quick] /depth [deep|quick] /phase <plan|draft|critique>
 *           /new <title> /switch <n> /ship [n|all] /end
 */
export async function POST(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch (e) {
    const reason = e instanceof Error ? e.message.split("\n")[0] : "Invalid ID token";
    return NextResponse.json({ error: `Invalid ID token (${reason})` }, { status: 401 });
  }

  const { sessionId, text } = (await req.json()) as { sessionId?: string; text?: string };
  let safeId: string;
  try {
    safeId = assertDocId(sessionId ?? "", "sessionId");
  } catch {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }
  const msg = (text ?? "").trim().slice(0, MAX_MSG);
  if (!msg) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const rate = checkRateLimit(`pair-msg:${uid}`, 20, 60000);
  if (!rate.success) {
    return NextResponse.json({ error: "Slow down — 20 messages/min max." }, { status: 429 });
  }

  const db = adminDb();
  const settings = await loadSettings(db, uid);
  if (!settings?.groqKey) {
    return NextResponse.json({ error: "Add your Groq API key in Settings first" }, { status: 400 });
  }

  const session = await getSession(db, uid, safeId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "open") {
    return NextResponse.json({ error: "Session is closed — start a new one." }, { status: 400 });
  }
  const active = activeArticle(session);
  if (!active) return NextResponse.json({ error: "Session has no articles" }, { status: 400 });

  const now = new Date().toISOString();
  const pushTurn = async (role: "user" | "assistant", t: string) => {
    session.history.push({ role, text: t, at: new Date().toISOString() });
  };

  // ---- Local slash commands (no LLM needed) ----
  if (msg.startsWith("/")) {
    const [cmd, ...rest] = msg.split(/\s+/);
    const arg = rest.join(" ").trim();

    if (cmd === "/end") {
      await sessionRef(db, uid, safeId).update({ status: "ended", updatedAt: now });
      return NextResponse.json({ ok: true, ended: true });
    }
    if (cmd === "/depth") {
      const depth = arg === "deep" ? "deep" : arg === "quick" ? "quick" : null;
      if (!depth) return NextResponse.json({ error: "Usage: /depth deep|quick" }, { status: 400 });
      session.critiqueDepth = depth;
      await sessionRef(db, uid, safeId).update({ critiqueDepth: depth, updatedAt: now });
      return NextResponse.json({ ok: true, session });
    }
    if (cmd === "/phase") {
      const p = arg === "plan" ? "plan" : arg === "draft" ? "draft" : arg === "critique" ? "critique" : null;
      if (!p) return NextResponse.json({ error: "Usage: /phase plan|draft|critique" }, { status: 400 });
      const hint =
        p === "plan"
          ? "We converge on angle and outline now — no drafting yet, spar with me."
          : p === "draft"
            ? "We write now — ask for sections or /rewrite the working copy."
            : "I evaluate without rewriting now — ask for /critique deep or quick.";
      session.phase = p;
      await pushTurn("user", msg);
      await pushTurn("assistant", `Phase set to ${p}. ${hint}`);
      await sessionRef(db, uid, safeId).update({
        phase: p,
        history: session.history,
        updatedAt: now,
      });
      return NextResponse.json({ ok: true, session });
    }
    if (cmd === "/new") {
      const title = arg.slice(0, 200) || `(untitled ${session.articles.length + 1})`;
      const article = {
        id: `a-${Date.now().toString(36)}`,
        title,
        format: "devto" as const,
        workingBody: "",
        excerpts: [],
        status: "seed" as const,
      };
      session.articles.push(article);
      session.activeArticleId = article.id;
      await pushTurn("user", msg);
      await pushTurn("assistant", `New article "${title}" on the bench (#${session.articles.length}). ${session.mode === "series" ? "Since we're in series mode, I'll keep it consistent with the rest —" : ""} what's the angle?`);
      await sessionRef(db, uid, safeId).update({
        articles: session.articles,
        activeArticleId: session.activeArticleId,
        history: session.history,
        updatedAt: now,
      });
      return NextResponse.json({ ok: true, session });
    }
    if (cmd === "/switch") {
      const n = Number.parseInt(arg, 10);
      if (!Number.isFinite(n) || n < 1 || n > session.articles.length) {
        return NextResponse.json({ error: `Usage: /switch 1-${session.articles.length}` }, { status: 400 });
      }
      const target = session.articles[n - 1];
      session.activeArticleId = target.id;
      await sessionRef(db, uid, safeId).update({ activeArticleId: target.id, updatedAt: now });
      return NextResponse.json({ ok: true, session });
    }
    if (cmd === "/ship") {
      let indices: number[];
      if (!arg || arg === "all") {
        indices = session.articles.map((_, i) => i);
      } else {
        const n = Number.parseInt(arg, 10);
        if (!Number.isFinite(n) || n < 1 || n > session.articles.length) {
          return NextResponse.json({ error: `Usage: /ship [1-${session.articles.length}|all]` }, { status: 400 });
        }
        indices = [n - 1];
      }
      const shipped = await shipArticles(db, uid, safeId, session, indices);
      if (!shipped.length) {
        return NextResponse.json({ error: "Nothing to ship — working copies are empty or already shipped." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, shipped, session });
    }
    // /rewrite, /critique fall through to the LLM with forced modes.
  }

  // ---- LLM turn (cap-enforced) ----
  const cap = await checkDailyLlmCap(db, uid, 1);
  if (!cap.allowed) {
    return NextResponse.json(
      { error: `Daily AI limit reached (${cap.used}/${cap.cap}). Try again tomorrow.` },
      { status: 429 }
    );
  }

  let forced: ForcedMode = "chat";
  let body = msg;
  if (msg.startsWith("/rewrite")) {
    forced = "rewrite";
    body = restOf(msg) || "Rewrite and strengthen the working copy, honoring our discussion.";
  } else if (msg.startsWith("/critique")) {
    forced = "critique";
    const arg1 = msg.split(/\s+/)[1];
    if (arg1 === "deep" || arg1 === "quick") session.critiqueDepth = arg1;
    body = `Critique the working copy (${session.critiqueDepth}).`;
  }

  const { loadVoiceProfile } = await import("@/lib/corpus/voice-analyzer");
  const voiceGuide = await loadVoiceProfile(db, uid);

  let reply: string;
  try {
    const res = await pairTurn(settings.groqKey, session, active, body, voiceGuide, forced);
    reply = res.text;
    await recordLlmUsage(db, uid, 1);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Groq failed: ${e.message}` : "Groq failed" },
      { status: 502 }
    );
  }

  await pushTurn("user", msg);
  await pushTurn("assistant", reply);

  const updates: Record<string, unknown> = { history: session.history, updatedAt: now };
  if (forced === "rewrite") {
    active.workingBody = reply;
    active.status = "drafting";
    if (session.phase === "plan") session.phase = "draft";
    updates.articles = session.articles;
    updates.phase = session.phase;
  } else if (forced === "critique") {
    if (session.phase !== "critique") {
      session.phase = "critique";
      updates.phase = "critique";
    }
    updates.articles = session.articles;
    updates.critiqueDepth = session.critiqueDepth;
  }

  // Rolling summary keeps the model window bounded; full history is kept.
  if (needsSummary(session)) {
    try {
      const compacted = await compactHistory(settings.groqKey, session);
      session.historySummary = compacted.summary;
      session.summarizedCount = compacted.summarizedCount;
      updates.historySummary = compacted.summary;
      updates.summarizedCount = compacted.summarizedCount;
      await recordLlmUsage(db, uid, 1);
    } catch {
      // Compaction is best-effort; the turn still lands.
    }
  }

  await sessionRef(db, uid, safeId).update(updates);
  return NextResponse.json({ ok: true, reply, session });

  function restOf(cmd: string): string {
    return cmd.split(/\s+/).slice(1).join(" ").trim().slice(0, MAX_MSG);
  }
}
