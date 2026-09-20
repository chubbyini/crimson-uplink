import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { publishToDevto } from "@/lib/publish/devto";
import { loadSettings } from "@/lib/pipeline";

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
    uid = (await adminAuth().verifyIdToken(token)).uid;
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

  const { draftId, published } = (await req.json()) as {
    draftId?: string;
    published?: boolean;
  };
  if (!draftId) return NextResponse.json({ error: "Missing draftId" }, { status: 400 });

  const db = adminDb();
  const draftSnap = await db.doc(`users/${uid}/drafts/${draftId}`).get();
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
    draftId,
    publishedAt: now,
  });
  batch.update(db.doc(`users/${uid}/drafts/${draftId}`), { status: "published" });
  await batch.commit();

  return NextResponse.json(result);
}
