import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { refineForLinkedin } from "@/lib/draft/generate";
import { loadSettings } from "@/lib/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/drafts/refine-linkedin — format/refine a draft strictly for LinkedIn (<3000 chars).
 * Body: { draftId: string }.
 * Writes users/{uid}/drafts/{draftId} (fields linkedinBody, linkedinRefinedAt).
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
  if (!settings) {
    return NextResponse.json({ error: "Save Settings first" }, { status: 400 });
  }
  if (!settings.groqKey) {
    return NextResponse.json(
      { error: "Add your Groq API key in Settings first" },
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
  };

  let refined: { text: string; model: string };
  try {
    refined = await refineForLinkedin(settings.groqKey, draft.title, draft.body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `LinkedIn refine failed: ${e.message}` : "LinkedIn refine failed" },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  await db.doc(`users/${uid}/drafts/${draftId}`).update({
    linkedinBody: refined.text,
    linkedinRefinedAt: now,
  });

  return NextResponse.json({
    draftId,
    linkedinBody: refined.text,
    characterCount: refined.text.length,
    model: refined.model,
  });
}
