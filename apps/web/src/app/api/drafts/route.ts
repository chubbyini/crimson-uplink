import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { generateDraft } from "@/lib/draft/generate";
import { buildDraftContext, formatContextSummary } from "@/lib/context/excerpts";
import { loadSettings } from "@/lib/pipeline";
import { assertDocId } from "@/lib/validation";

import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/drafts — draft an approved idea with the user's Groq key.
 * Body: { ideaId: string }.
 * Writes users/{uid}/drafts/{id} (status pending_review), marks idea drafted.
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

  const rate = checkRateLimit(uid, 15, 60000);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again shortly." },
      { status: 429 }
    );
  }

  const settings = await loadSettings(adminDb(), uid);
  if (!settings) {
    return NextResponse.json({ error: "Save Settings first" }, { status: 400 });
  }
  if (!settings.groqKey) {
    return NextResponse.json(
      { error: "Add your Groq API key in Settings first" },
      { status: 400 }
    );
  }

  const { ideaId } = (await req.json()) as { ideaId?: string };
  let safeIdeaId: string;
  try {
    safeIdeaId = assertDocId(ideaId ?? "", "ideaId");
  } catch {
    return NextResponse.json({ error: "Invalid ideaId" }, { status: 400 });
  }

  const db = adminDb();
  const ideaSnap = await db.doc(`users/${uid}/ideas/${safeIdeaId}`).get();
  if (!ideaSnap.exists) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }
  const idea = ideaSnap.data() as {
    title: string;
    angle: string;
    format: "linkedin" | "x" | "devto";
    sourceUrls: string[];
    status: string;
    sourceExcerpts?: Array<{ url: string; excerpt: string; via: "jina" | "self" }>;
  };
  if (idea.status !== "approved" && idea.status !== "drafted") {
    return NextResponse.json({ error: "Approve the idea first" }, { status: 400 });
  }
  if (!idea.title?.trim() || !idea.angle?.trim()) {
    return NextResponse.json({ error: "Idea is missing title/angle" }, { status: 400 });
  }

  const { loadVoiceProfile } = await import("@/lib/corpus/voice-analyzer");
  const voiceGuide = await loadVoiceProfile(db, uid);

  let draft: { text: string; model: string };
  let contextSummary = "Sources unreadable — drafted from headline, please double-check";
  let contextSources: string[] = [];
  let contextChars = 0;
  try {
    const ctx = await buildDraftContext(
      idea.sourceExcerpts?.length
        ? idea.sourceExcerpts
        : (idea.sourceUrls ?? []).map((url) => ({ url })),
      { jinaKey: settings.jinaKey || undefined }
    );
    contextSummary = formatContextSummary(ctx);
    contextSources = ctx.sources.map((s) => s.url);
    contextChars = ctx.chars;
    draft = await generateDraft(settings.groqKey, {
      title: idea.title,
      angle: idea.angle,
      format: idea.format,
      sourceUrls: idea.sourceUrls ?? [],
    }, voiceGuide, ctx.sources);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Groq failed: ${e.message}` : "Groq failed" },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  const ref = db.collection(`users/${uid}/drafts`).doc();
  const batch = db.batch();
  batch.set(ref, {
    ideaId: safeIdeaId,
    title: idea.title,
    format: idea.format,
    body: draft.text,
    model: draft.model,
    status: "pending_review",
    createdAt: now,
    contextSources,
    contextChars,
    contextSummary,
  });
  batch.update(db.doc(`users/${uid}/ideas/${safeIdeaId}`), { status: "drafted" });
  await batch.commit();

  return NextResponse.json({ id: ref.id, ...draft, ideaId: safeIdeaId, contextSummary });
}
