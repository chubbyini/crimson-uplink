import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { publishToLinkedin } from "@/lib/publish/linkedin";
import { loadSettings } from "@/lib/pipeline";

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

  const { draftId } = (await req.json()) as { draftId?: string };
  if (!draftId) return NextResponse.json({ error: "Missing draftId" }, { status: 400 });

  const db = adminDb();
  const draftSnap = await db.doc(`users/${uid}/drafts/${draftId}`).get();
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
    draftId,
    publishedAt: now,
  });
  batch.update(db.doc(`users/${uid}/drafts/${draftId}`), { status: "published" });
  await batch.commit();

  return NextResponse.json(result);
}
