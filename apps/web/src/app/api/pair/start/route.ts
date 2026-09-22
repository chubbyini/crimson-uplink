import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { loadSettings } from "@/lib/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertDocId } from "@/lib/validation";
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

  const { entry, entries, mode } = (await req.json()) as {
    entry?: SeedEntry;
    entries?: SeedEntry[];
    mode?: PairMode;
  };
  // Batch supported: entries[] (max 8). Legacy single entry still works.
  const seeds = Array.isArray(entries) && entries.length ? entries.slice(0, 8) : entry ? [entry] : [];
  if (!seeds.length || !seeds.every((e) => e && typeof e === "object" && "kind" in e)) {
    return NextResponse.json({ error: "Missing session seed (entry/entries)" }, { status: 400 });
  }
  const pairMode: PairMode = mode === "batch" ? "batch" : seeds.length > 1 ? "batch" : "series";

  const db = adminDb();

  // Build one article per seed.
  const articles: PairArticle[] = [];
  const seedNotes: string[] = [];
  let phase: "plan" | "draft" = "plan";
  try {
    let n = 0;
    for (const seed of seeds) {
      n += 1;
      const stamp = `${Date.now().toString(36)}-${n}`;
      if (seed.kind === "idea") {
        const ideaId = assertDocId(seed.ideaId ?? "", "ideaId");
        const snap = await db.doc(`users/${uid}/ideas/${ideaId}`).get();
        if (!snap.exists) return NextResponse.json({ error: `Idea not found (${ideaId.slice(0, 12)}…)` }, { status: 404 });
        const idea = snap.data() as {
          title: string;
          angle: string;
          format?: "linkedin" | "x" | "devto";
          sourceExcerpts?: Array<{ url: string; excerpt: string; via: "jina" | "self" }>;
        };
        articles.push({
          id: `a-${stamp}`,
          title: idea.title,
          format: idea.format ?? "devto",
          workingBody: "",
          excerpts: (idea.sourceExcerpts ?? []).slice(0, 6),
          status: "seed",
          ideaId,
        });
        if (idea.angle?.trim()) seedNotes.push(`Article ${n} angle: ${idea.angle.trim().slice(0, 300)}`);
      } else if (seed.kind === "draft") {
        const draftId = assertDocId(seed.draftId ?? "", "draftId");
        const snap = await db.doc(`users/${uid}/drafts/${draftId}`).get();
        if (!snap.exists) return NextResponse.json({ error: `Draft not found (${draftId.slice(0, 12)}…)` }, { status: 404 });
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
        articles.push({
          id: `a-${stamp}`,
          title: d.title ?? "(untitled)",
          format: d.format ?? "devto",
          workingBody: d.body ?? "",
          excerpts,
          status: "seed",
        });
        if (d.body?.trim()) phase = "draft";
      } else if (seed.kind === "blank") {
        const topic = (seed.topic ?? "").trim().slice(0, 300);
        if (!topic) return NextResponse.json({ error: `Seed ${n}: missing topic` }, { status: 400 });
        articles.push({
          id: `a-${stamp}`,
          title: topic,
          format: "devto",
          workingBody: "",
          excerpts: [],
          status: "seed",
        });
      } else if (seed.kind === "excerpts") {
        const title = (seed.title ?? "").trim().slice(0, 200) || "(untitled)";
        const material = (seed.material ?? "").trim().slice(0, 20000);
        if (!material) return NextResponse.json({ error: `Seed ${n}: missing pasted material` }, { status: 400 });
        articles.push({
          id: `a-${stamp}`,
          title,
          format: "devto",
          workingBody: "",
          excerpts: [{ url: "pasted-material", excerpt: material.slice(0, 6000), via: "self" }],
          status: "seed",
        });
      } else if (seed.kind === "paragraph") {
        const title = (seed.title ?? "").trim().slice(0, 200) || "(untitled)";
        const paragraph = (seed.paragraph ?? "").trim().slice(0, 20000);
        if (!paragraph) return NextResponse.json({ error: `Seed ${n}: missing paragraph` }, { status: 400 });
        articles.push({
          id: `a-${stamp}`,
          title,
          format: "devto",
          workingBody: paragraph,
          excerpts: [],
          status: "seed",
        });
        phase = "draft";
      } else {
        return NextResponse.json({ error: `Seed ${n}: unknown kind` }, { status: 400 });
      }
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
    title: articles.length > 1 ? `${articles[0].title} +${articles.length - 1}` : articles[0].title,
    mode: pairMode,
    phase,
    articles,
    activeArticleId: articles[0].id,
    history: [],
    historySummary: "",
    summarizedCount: 0,
    critiqueDepth: "quick" as const,
    status: "open" as const,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(session);

  // Opening partner message: static so sessions open instantly (no blocking
  // LLM call). The first real turn carries full context.
  const seedNote = seedNotes.join(" ");
  const opener =
    articles.length > 1
      ? `Batch session live — ${articles.length} articles on the bench (${articles.map((a, i) => `${i + 1}. "${a.title}"`).join("; ")}). Tell me where to start: angle, audience, what's bugging you. Commands: /rewrite /critique /phase /switch /ship /end.`
      : `Let's build "${articles[0].title}" together. Tell me where your head is at — angle, audience, what's bugging you — and we'll shape it from there. Commands: /rewrite /critique /phase /ship /end.${seedNote ? ` Note: ${seedNote}` : ""}`;

  await ref.update({
    history: [{ role: "assistant", text: opener, at: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ id: ref.id, ...session, history: [{ role: "assistant", text: opener, at: now }] });
}
