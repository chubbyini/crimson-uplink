import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { ingestForUser, loadSettings } from "@/lib/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ingest — run the morning pull on demand for the signed-in user.
 * Auth: Firebase ID token in `Authorization: Bearer <token>`.
 * Writes deduped docs to users/{uid}/items/{urlHash}.
 */
export async function POST(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Server not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON to env (see apps/web/.env.example).",
      },
      { status: 503 }
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch (e) {
    const reason =
      e instanceof Error ? e.message.split("\n")[0] : "Invalid ID token";
    return NextResponse.json(
      { error: `Invalid ID token (${reason}). Try signing out/in; if it persists, sync your system clock.` },
      { status: 401 }
    );
  }

  try {
    const db = adminDb();
    const settings = await loadSettings(db, uid);
    if (!settings) {
      return NextResponse.json({ error: "Save Settings first" }, { status: 400 });
    }

    const result = await ingestForUser(db, uid, settings);
    return NextResponse.json(result);
  } catch (err) {
    console.error("API /api/ingest failure:", err);
    const message = err instanceof Error ? err.message : "Ingest pipeline failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
