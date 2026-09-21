import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { loadSettings } from "@/lib/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DevtoMeArticle {
  id: number;
  url?: string;
  page_views_count?: number;
  public_reactions_count?: number;
  comments_count?: number;
}

/**
 * POST /api/stats/sync — refresh Dev.to stats for the user's logged publishes.
 * Auth: Firebase ID token. Matches publishes by devtoId against
 * GET /api/articles/me (keyed — includes page_views_count).
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

  const settings = await loadSettings(adminDb(), uid);
  if (!settings?.devtoKey) {
    return NextResponse.json(
      { error: "Add your Dev.to API key in Settings first" },
      { status: 400 }
    );
  }

  const res = await fetch("https://dev.to/api/articles/me?per_page=100", {
    headers: { "api-key": settings.devtoKey },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Dev.to API failed: ${res.status}` },
      { status: 502 }
    );
  }
  const articles = (await res.json()) as DevtoMeArticle[];
  const byId = new Map(articles.map((a) => [a.id, a]));

  const db = adminDb();
  const pubs = await db
    .collection(`users/${uid}/publishes`)
    .where("platform", "==", "devto")
    .get();

  let updated = 0;
  const BATCH_CHUNK = 400;
  let batch = db.batch();
  let pending = 0;
  const flush = async () => {
    if (pending) await batch.commit();
    batch = db.batch();
    pending = 0;
  };
  for (const doc of pubs.docs) {
    const devtoId = (doc.data() as { devtoId?: number }).devtoId;
    const match = devtoId != null ? byId.get(devtoId) : undefined;
    if (!match) continue;
    batch.set(
      doc.ref,
      {
        views: match.page_views_count ?? 0,
        reactions: match.public_reactions_count ?? 0,
        comments: match.comments_count ?? 0,
        url: match.url ?? doc.data().url,
        syncedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    updated += 1;
    pending += 1;
    if (pending >= BATCH_CHUNK) await flush();
  }
  await flush();

  return NextResponse.json({ checked: pubs.size, updated });
}
