import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { generateDraft } from "@/lib/draft/generate";
import { buildDraftContext, formatContextSummary } from "@/lib/context/excerpts";
import { loadSettings, storeItems, enrichAndScore } from "@/lib/pipeline";
import { searchTopics } from "@/lib/search";

import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/content — on-demand topic research.
 * Body: { topics: string[], autoDraft?: boolean (default true) }.
 * Searches every queryable source, dedupe-stores items, scores ideas with
 * Gemini, and drafts the top idea with Groq. Returns the chain for display.
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
    const reason =
      e instanceof Error ? e.message.split("\n")[0] : "Invalid ID token";
    return NextResponse.json({ error: `Invalid ID token (${reason})` }, { status: 401 });
  }

  const rate = checkRateLimit(uid, 10, 60000);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded (10 requests/min). Please try again shortly." },
      { status: 429 }
    );
  }

  const { topics, autoDraft } = (await req.json()) as {
    topics?: string[];
    autoDraft?: boolean;
  };
  const clean = (topics ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (!clean.length) {
    return NextResponse.json({ error: "Enter at least one topic" }, { status: 400 });
  }

  const settings = await loadSettings(adminDb(), uid);
  if (!settings) {
    return NextResponse.json({ error: "Save Settings first" }, { status: 400 });
  }
  if (!settings.geminiKey) {
    return NextResponse.json(
      { error: "Add your Gemini API key in Settings first" },
      { status: 400 }
    );
  }

  const db = adminDb();
  const { checkDailyLlmCap, recordLlmUsage } = await import("@/lib/usage");
  const cap = await checkDailyLlmCap(db, uid, 2);
  if (!cap.allowed) {
    return NextResponse.json({ error: `Daily AI limit reached (${cap.used}/${cap.cap}). Try again tomorrow.` }, { status: 429 });
  }
  const raw = await searchTopics({ topics: clean, githubToken: settings.githubToken || undefined });
  const now = new Date().toISOString();

  // Enrich top candidates with article excerpts, then score (angles reflect
  // the originals). Enriched items are stored so excerpts hit the item cache.
  const forScoring = [...new Map(raw.map((i) => [i.url, i])).values()];
  let scored;
  try {
    scored = await enrichAndScore(
      settings.geminiKey,
      settings.jinaKey || undefined,
      forScoring,
      clean
    );
  } catch (e) {
    return NextResponse.json(
      {
        fetched: raw.length,
        unique: 0,
        added: 0,
        error: e instanceof Error ? `Gemini failed: ${e.message}` : "Gemini failed",
      },
      { status: 502 }
    );
  }
  const stored = await storeItems(db, uid, scored.enrichedItems, { topicSearch: clean });
  const ideas = scored.ideas;

  const ideaBatch = db.batch();
  const cleanIdea = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const ideaIds = ideas.map((idea) => {
    const ref = db.collection(`users/${uid}/ideas`).doc();
    ideaBatch.set(ref, {
      ...cleanIdea(idea as unknown as Record<string, unknown>),
      status: "new",
      createdAt: now,
      topicSearch: clean,
    });
    return ref.id;
  });
  await ideaBatch.commit();

  // Auto-draft the top idea (skipped cleanly without a Groq key).
  let draft: { id: string; title: string; contextSummary?: string } | null = null;
  let draftNote: string | undefined;
  if (autoDraft !== false && ideas.length) {
    if (!settings.groqKey) {
      draftNote = "Top idea saved — add a Groq key in Settings to auto-draft";
    } else {
      try {
        const top = ideas[0];
        const { loadVoiceProfile } = await import("@/lib/corpus/voice-analyzer");
        const voiceGuide = await loadVoiceProfile(db, uid);
        const ctx = await buildDraftContext(
          top.sourceExcerpts?.length
            ? top.sourceExcerpts
            : (top.sourceUrls ?? []).map((url) => ({ url })),
          { jinaKey: settings.jinaKey || undefined }
        );
        const contextSummary = formatContextSummary(ctx);
        const text = await generateDraft(settings.groqKey, {
          title: top.title,
          angle: top.angle,
          format: top.format,
          sourceUrls: top.sourceUrls,
        }, voiceGuide, ctx.sources);
        const ref = db.collection(`users/${uid}/drafts`).doc();
        await ref.set({
          ideaId: ideaIds[0],
          title: top.title,
          format: top.format,
          body: text.text,
          model: text.model,
          status: "pending_review",
          createdAt: now,
          topicSearch: clean,
          contextSources: ctx.sources.map((s) => s.url),
          contextChars: ctx.chars,
          contextSummary,
        });
        await db.doc(`users/${uid}/ideas/${ideaIds[0]}`).update({ status: "drafted" });
        draft = { id: ref.id, title: top.title, contextSummary };
      } catch (e) {
        draftNote = e instanceof Error ? `Groq failed: ${e.message}` : "Groq failed";
      }
    }
  }

  await recordLlmUsage(db, uid, draft ? 2 : 1);
  return NextResponse.json({
    topics: clean,
    fetched: raw.length,
    unique: stored.unique,
    added: stored.added,
    ideas: ideas.map((idea, n) => ({ ...idea, id: ideaIds[n] })),
    draft,
    draftNote,
  });
}
