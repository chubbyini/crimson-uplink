import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { loadSettings, scoreForUser } from "@/lib/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ideas — score the user's freshest items into a top-10 idea bank.
 * Auth: Firebase ID token in `Authorization: Bearer <token>`.
 * Reads users/{uid}/items (latest 40), writes users/{uid}/ideas.
 */
export async function POST(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: "Server not configured (FIREBASE_SERVICE_ACCOUNT_JSON)." },
      { status: 503 }
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch (e) {
    const reason =
      e instanceof Error ? e.message.split("\n")[0] : "Invalid ID token";
    return NextResponse.json(
      { error: `Invalid ID token (${reason}). Try signing out/in; if it persists, sync your system clock.` },
      { status: 401 }
    );
  }

  const settings = await loadSettings(adminDb(), uid);
  if (!settings) {
    return NextResponse.json({ error: "Save Settings first" }, { status: 400 });
  }

  try {
    return NextResponse.json(await scoreForUser(adminDb(), uid, settings));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scoring failed";
    const status = message.startsWith("Gemini failed") ? 502 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
