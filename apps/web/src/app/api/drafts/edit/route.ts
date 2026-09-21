import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { editDraftWithGroq } from "@/lib/draft/generate";
import { loadSettings } from "@/lib/pipeline";
import { assertDocId } from "@/lib/validation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/drafts/edit — edit/refine a draft with the user's Groq key based on user instructions.
 * Body: { draftId?: string, currentBody?: string, prompt: string }.
 * If draftId is provided, updates users/{uid}/drafts/{draftId} in Firestore.
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

  const { draftId, currentBody, prompt } = (await req.json()) as {
    draftId?: string;
    currentBody?: string;
    prompt?: string;
  };

  if (!prompt?.trim() || prompt.length > 4000) {
    return NextResponse.json({ error: "Missing prompt instruction" }, { status: 400 });
  }
  let safeDraftId: string | null = null;
  if (draftId) {
    try {
      safeDraftId = assertDocId(draftId, "draftId");
    } catch {
      return NextResponse.json({ error: "Invalid draftId" }, { status: 400 });
    }
  }

  const db = adminDb();
  let bodyToEdit = (currentBody ?? "").slice(0, 60000);

  if (safeDraftId) {
    const draftSnap = await db.doc(`users/${uid}/drafts/${safeDraftId}`).get();
    if (!draftSnap.exists) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    const draftData = draftSnap.data() as { body?: string };
    if (!bodyToEdit && draftData.body) {
      bodyToEdit = draftData.body;
    }
  }

  if (!bodyToEdit.trim()) {
    return NextResponse.json({ error: "Missing article body content to edit" }, { status: 400 });
  }

  let edited: { text: string; model: string };
  try {
    edited = await editDraftWithGroq(settings.groqKey, bodyToEdit, prompt.trim());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Groq edit failed: ${e.message}` : "Groq edit failed" },
      { status: 502 }
    );
  }

  if (safeDraftId) {
    await db.doc(`users/${uid}/drafts/${safeDraftId}`).update({
      body: edited.text,
      editedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ text: edited.text, model: edited.model, draftId: safeDraftId });
}
