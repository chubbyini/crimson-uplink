import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { loadSettings } from "@/lib/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkDailyLlmCap, recordLlmUsage } from "@/lib/usage";
import { assertDocId } from "@/lib/validation";
import { pairTurn } from "@/lib/pair/chat";
import type {
  PairArticle,
  PairMode,
  SeedEntry,
} from "@/lib/pair/sessions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/pair/start — open a pair-writing session.
 * Body: { entry: SeedEntry, mode?: "series" | "batch" }.
 * Seed: idea | draft | blank topic | pasted excerpts | user paragraph.
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

  const rate = checkRateLimit(`pair:${uid}`, 10, 60000);
  if (!rate.success) {
    return NextResponse.json({ error: "Rate limit exceeded. Please try again shortly." }, { status: 429 });
  }

  const settings = await loadSettings(adminDb(), uid);
  if (!settings) return NextResponse.json({ error: "Save Settings first" }, { status: 400 });
  if (!settings.groqKey) {
    return NextResponse.json({ error: "Add your Groq API key in Settings first" }, { status: 400 });
  }

  const { entry, mode } = (await req.json()) as { entry?: SeedEntry; mode?: PairMode };
  if (!entry || typeof entry !== "object" || !("kind" in entry)) {
    return NextResponse.json({ error: "Missing session seed (entry)" }, { status: 400 });
  }
  const pairMode: PairMode = mode === "batch" ? "batch" : "series";

  const db = adminDb();
  const cap = await checkDailyLlmCap(db, uid, 1);
  if (!cap.allowed) {
    return NextResponse.json(
      { error: `Daily AI limit reached (${cap.used}/${cap.cap}). Try again tomorrow.` },
      { status: 429 }
    );
  }

  // Build the first article from the seed.
  let article: PairArticle;
  let phase: "plan" | "draft" = "plan";
  let seedNote = "";
  try {
    if (entry.kind === "idea") {
      const ideaId = assertDocId(entry.ideaId ?? "", "ideaId");
      const snap = await db.doc(`users/${uid}/ideas/${ideaId}`).get();
      if (!snap.exists) return NextResponse.json({ error: "Idea not found" }, { status: 404 });
      const idea = snap.data() as {
        title: string;
        angle: string;
        format?: "linkedin" | "x" | "devto";
        sourceExcerpts?: Array<{ url: string; excerpt: string; via: "jina" | "self" }>;
      };
      article = {
        id: `a-${Date.now().toString(36)}`,
        title: idea.title,
        format: idea.format ?? "devto",
        workingBody: "",
        excerpts: (idea.sourceExcerpts ?? []).slice(0, 6),
        status: "seed",
        ideaId,
      };
      if (idea.angle?.trim()) seedNote = `Agreed angle so far: ${idea.angle.trim().slice(0, 500)}`;
    } else if (entry.kind === "draft") {
      const draftId = assertDocId(entry.draftId ?? "", "draftId");
      const snap = await db.doc(`users/${uid}/drafts/${draftId}`).get();
      if (!snap.exists) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      const d = snap.data() as {
        title?: string;
        body?: string;
        format?: "linkedin" | "x" | "devto";
        contextSources?: string[];
      };
      let excerpts: PairArticle["excerpts"] = [];
      if (d.contextSources?.length) {
        try {
          const { buildDraftContext } = await import("@/lib/context/excerpts");
          const ctx = await buildDraftContext(
            d.contextSources.map((url) => ({ url })),
            { jinaKey: settings.jinaKey || undefined }
          );
          excerpts = ctx.sources.flatMap((s) => [
            ...(s.jina ? [{ url: s.url, excerpt: s.jina.slice(0, 2000), via: "jina" as const }] : []),
            ...(s.self ? [{ url: s.url, excerpt: s.self.slice(0, 2000), via: "self" as const }] : []),
          ]).slice(0, 6);
        } catch {
          // Seed proceeds without excerpts.
        }
      }
      article = {
        id: `a-${Date.now().toString(36)}`,
        title: d.title ?? "(untitled)",
        format: d.format ?? "devto",
        workingBody: d.body ?? "",
        excerpts,
        status: "seed",
      };
      phase = d.body?.trim() ? "draft" : "plan";
    } else if (entry.kind === "blank") {
      const topic = (entry.topic ?? "").trim().slice(0, 300);
      if (!topic) return NextResponse.json({ error: "Missing topic" }, { status: 400 });
      article = {
        id: `a-${Date.now().toString(36)}`,
        title: topic,
        format: "devto",
        workingBody: "",
        excerpts: [],
        status: "seed",
      };
    } else if (entry.kind === "excerpts") {
      const title = (entry.title ?? "").trim().slice(0, 200) || "(untitled)";
      const material = (entry.material ?? "").trim().slice(0, 20000);
      if (!material) return NextResponse.json({ error: "Missing pasted material" }, { status: 400 });
      article = {
        id: `a-${Date.now().toString(36)}`,
        title,
        format: "devto",
        workingBody: "",
        excerpts: [{ url: "pasted-material", excerpt: material.slice(0, 6000), via: "self" }],
        status: "seed",
      };
    } else if (entry.kind === "paragraph") {
      const title = (entry.title ?? "").trim().slice(0, 200) || "(untitled)";
      const paragraph = (entry.paragraph ?? "").trim().slice(0, 20000);
      if (!paragraph) return NextResponse.json({ error: "Missing paragraph" }, { status: 400 });
      article = {
        id: `a-${Date.now().toString(36)}`,
        title,
        format: "devto",
        workingBody: paragraph,
        excerpts: [],
        status: "seed",
      };
      phase = "draft";
    } else {
      return NextResponse.json({ error: "Unknown seed kind" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid seed" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const ref = db.collection(`users/${uid}/pair-sessions`).doc();
  const session = {
    title: article.title,
    mode: pairMode,
    phase,
    articles: [article],
    activeArticleId: article.id,
    history: [],
    historySummary: "",
    summarizedCount: 0,
    critiqueDepth: "quick" as const,
    status: "open" as const,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(session);

  // Opening partner message (one LLM call; static fallback keeps it robust).
  const { loadVoiceProfile } = await import("@/lib/corpus/voice-analyzer");
  const voiceGuide = await loadVoiceProfile(db, uid);
  let opener = `Let's build "${article.title}" together. Tell me where your head is at — angle, audience, what's bugging you — and we'll shape it from there. Commands: /rewrite /critique /new /switch /ship /end.`;
  try {
    const res = await pairTurn(
      settings.groqKey,
      { ...session, history: [], historySummary: "", summarizedCount: 0 },
      article,
      `(A new pair-writing session just started. Open the collaboration in 3-5 sentences: what excites you about this piece, one sharp question about angle or audience, and how we'll work. Do not draft yet.${seedNote ? ` ${seedNote}` : ""})`,
      voiceGuide,
      "chat"
    );
    opener = res.text;
    await recordLlmUsage(db, uid, 1);
  } catch {
    // Static opener above.
  }

  await ref.update({
    history: [{ role: "assistant", text: opener, at: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ id: ref.id, ...session, history: [{ role: "assistant", text: opener, at: now }] });
}
