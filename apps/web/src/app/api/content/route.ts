import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { generateDraft } from "@/lib/draft/generate";
import { urlHash } from "@/lib/ingest/normalize";
import type { RawItem } from "@/lib/ingest/types";
import { loadSettings } from "@/lib/pipeline";
import { scoreIdeas } from "@/lib/ideas/score";
import { searchTopics } from "@/lib/search";

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
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch (e) {
    const reason =
      e instanceof Error ? e.message.split("\n")[0] : "Invalid ID token";
    return NextResponse.json({ error: `Invalid ID token (${reason})` }, { status: 401 });
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
  const raw = await searchTopics({ topics: clean, githubToken: settings.githubToken || undefined });
  const now = new Date().toISOString();

  // Dedupe-store (same items collection as the morning pull).
  const refs = new Map<string, RawItem>();
  for (const item of raw) {
    try {
      refs.set(urlHash(item.url), item);
    } catch {
      // Skip.
    }
  }
  const snaps = refs.size
    ? await db.getAll(...[...refs.keys()].map((h) => db.doc(`users/${uid}/items/${h}`)))
    : [];
  const existing = new Set(snaps.filter((s) => s.exists).map((s) => s.id));
  const batch = db.batch();
  let added = 0;
  for (const [hash, item] of refs) {
    if (!existing.has(hash)) {
      batch.set(db.doc(`users/${uid}/items/${hash}`), {
        ...item,
        hash,
        firstSeenAt: now,
        lastSeenAt: now,
        topicSearch: clean,
      });
      added += 1;
    }
  }
  if (refs.size) await batch.commit();

  // Score the haul.
  let ideas;
  try {
    ideas = await scoreIdeas(
      settings.geminiKey,
      [...refs.values()].map((i) => ({
        title: i.title,
        url: i.url,
        source: i.source,
        points: i.points,
        commentCount: i.commentCount,
      }))
    );
  } catch (e) {
    return NextResponse.json(
      {
        fetched: raw.length,
        unique: refs.size,
        added,
        error: e instanceof Error ? `Gemini failed: ${e.message}` : "Gemini failed",
      },
      { status: 502 }
    );
  }

  const ideaBatch = db.batch();
  const ideaIds = ideas.map((idea) => {
    const ref = db.collection(`users/${uid}/ideas`).doc();
    ideaBatch.set(ref, {
      ...idea,
      status: "new",
      createdAt: now,
      topicSearch: clean,
    });
    return ref.id;
  });
  await ideaBatch.commit();

  // Auto-draft the top idea (skipped cleanly without a Groq key).
  let draft: { id: string; title: string } | null = null;
  let draftNote: string | undefined;
  if (autoDraft !== false && ideas.length) {
    if (!settings.groqKey) {
      draftNote = "Top idea saved — add a Groq key in Settings to auto-draft";
    } else {
      try {
        const top = ideas[0];
        const text = await generateDraft(settings.groqKey, {
          title: top.title,
          angle: top.angle,
          format: top.format,
          sourceUrls: top.sourceUrls,
        });
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
        });
        await db.doc(`users/${uid}/ideas/${ideaIds[0]}`).update({ status: "drafted" });
        draft = { id: ref.id, title: top.title };
      } catch (e) {
        draftNote = e instanceof Error ? `Groq failed: ${e.message}` : "Groq failed";
      }
    }
  }

  return NextResponse.json({
    topics: clean,
    fetched: raw.length,
    unique: refs.size,
    added,
    ideas: ideas.map((idea, n) => ({ ...idea, id: ideaIds[n] })),
    draft,
    draftNote,
  });
}
