import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { fetchDevtoCorpus, fetchGithubCorpus, storeCorpusItems, type CustomArticleInput } from "@/lib/corpus/ingest";
import { loadSettings } from "@/lib/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";
import type { CorpusItem } from "@/lib/corpus/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/corpus — retrieve corpus items & active voice profile.
 */
export async function GET(req: Request) {
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

  const db = adminDb();
  const corpusSnap = await db.collection(`users/${uid}/corpus`).orderBy("createdAt", "desc").get();
  const items = corpusSnap.docs.map((d) => d.data() as CorpusItem);

  const voiceSnap = await db.doc(`users/${uid}/voice/profile`).get();
  const voiceProfile = voiceSnap.exists ? voiceSnap.data() : null;

  return NextResponse.json({ items, voiceProfile });
}

/**
 * POST /api/corpus — ingest Dev.to, GitHub READMEs, or custom articles (multiple custom articles supported).
 * Body: { syncDevto?: boolean, syncGithub?: boolean, articles?: Array<{ title?: string, content: string }> }.
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

  const rate = checkRateLimit(uid, 15, 60000);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again shortly." },
      { status: 429 }
    );
  }

  const { syncDevto, syncGithub, articles } = (await req.json()) as {
    syncDevto?: boolean;
    syncGithub?: boolean;
    articles?: CustomArticleInput[];
  };

  const settings = await loadSettings(adminDb(), uid);
  const db = adminDb();
  const toStore: Omit<CorpusItem, "id">[] = [];
  const now = new Date().toISOString();

  if (syncDevto && settings?.devtoKey) {
    const devtoItems = await fetchDevtoCorpus(settings.devtoKey);
    toStore.push(...devtoItems);
  }

  if (syncGithub && settings?.githubToken) {
    const githubItems = await fetchGithubCorpus(settings.githubToken);
    toStore.push(...githubItems);
  }

  if (articles && Array.isArray(articles)) {
    for (const a of articles.slice(0, 20)) {
      const content = typeof a.content === "string" ? a.content.trim().slice(0, 60000) : "";
      if (content.length > 20) {
        toStore.push({
          title: (a.title?.trim() || `Writing Sample (${new Date().toLocaleDateString()})`).slice(0, 300),
          source: "custom",
          body: content,
          wordCount: content.split(/\s+/).length,
          createdAt: now,
        });
      }
    }
  }

  if (!toStore.length) {
    return NextResponse.json({ error: "No valid articles or ingestion sources provided" }, { status: 400 });
  }

  const result = await storeCorpusItems(db, uid, toStore);

  return NextResponse.json({ success: true, added: result.added, total: result.total });
}
