import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { publishToLinkedin } from "@/lib/publish/linkedin";
import { loadSettings } from "@/lib/pipeline";
import { assertDocId } from "@/lib/validation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/publish/linkedin — publish an approved draft as a member post.
 * Body: { draftId: string }.
 * Needs the user's LinkedIn token (Settings; see docs/LINKEDIN_SETUP.md).
 * Logs users/{uid}/publishes and marks the draft published.
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
  if (!settings?.linkedinToken) {
    return NextResponse.json(
      { error: "Add your LinkedIn token in Settings first (see docs/LINKEDIN_SETUP.md)" },
      { status: 400 }
    );
  }

  const { draftId, idempotencyKey } = (await req.json()) as { draftId?: string; idempotencyKey?: string };
  let safeId: string;
  try {
    safeId = assertDocId(draftId ?? "", "draftId");
  } catch {
    return NextResponse.json({ error: "Invalid draftId" }, { status: 400 });
  }

  const db = adminDb();
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
    format: string;
    status: string;
  };
  if (draft.status !== "approved") {
    return NextResponse.json(
      { error: "Approve the draft first" },
      { status: 400 }
    );
  }
  if (draft.format !== "linkedin") {
    return NextResponse.json(
      { error: "LinkedIn publish needs a linkedin-format draft" },
      { status: 400 }
    );
  }

  let result: { postUrn: string; url: string };
  try {
    result = await publishToLinkedin(settings.linkedinToken, draft.body);
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
    platform: "linkedin",
    url: result.url,
    draftId: safeId,
    idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey.slice(0, 64) : null,
    publishedAt: now,
  });
  batch.update(db.doc(`users/${uid}/drafts/${safeId}`), { status: "published" });
  await batch.commit();

  return NextResponse.json(result);
}
