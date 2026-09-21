import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { publishToDevto } from "@/lib/publish/devto";
import { loadSettings } from "@/lib/pipeline";
import { assertDocId } from "@/lib/validation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/publish/devto — publish an approved draft to Dev.to.
 * Body: { draftId: string, published?: boolean (default true) }.
 * Logs users/{uid}/publishes (devtoId enables stats auto-sync) and marks the
 * draft published.
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

  const { draftId, published, idempotencyKey } = (await req.json()) as {
    draftId?: string;
    published?: boolean;
    idempotencyKey?: string;
  };
  let safeId: string;
  try {
    safeId = assertDocId(draftId ?? "", "draftId");
  } catch {
    return NextResponse.json({ error: "Invalid draftId" }, { status: 400 });
  }

  const db = adminDb();
  // Dedupe: same draft + same key must not publish twice on retry/double-click.
  if (idempotencyKey && /^[A-Za-z0-9_-]{1,64}$/.test(idempotencyKey)) {
    const dupe = await db
      .collection(`users/${uid}/publishes`)
      .where("draftId", "==", safeId)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
    if (!dupe.empty) {
      return NextResponse.json({ deduped: true, url: (dupe.docs[0].data() as { url?: string }).url ?? null });
    }
  }
  const draftSnap = await db.doc(`users/${uid}/drafts/${safeId}`).get();
  if (!draftSnap.exists) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  const draft = draftSnap.data() as {
    title: string;
    body: string;
    status: string;
  };
  if (draft.status !== "approved") {
    return NextResponse.json(
      { error: "Approve the draft first" },
      { status: 400 }
    );
  }

  let result: { id: number; url: string };
  try {
    result = await publishToDevto(settings.devtoKey, {
      title: draft.title,
      bodyMarkdown: draft.body,
      published: published ?? true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Publish failed" },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  batch.set(db.collection(`users/${uid}/publishes`).doc(), {
    title: draft.title,
    platform: "devto",
    url: result.url,
    devtoId: result.id,
    draftId: safeId,
    idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey.slice(0, 64) : null,
    publishedAt: now,
  });
  batch.update(db.doc(`users/${uid}/drafts/${safeId}`), { status: "published" });
  await batch.commit();

  return NextResponse.json(result);
}
