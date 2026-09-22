import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { assertDocId } from "@/lib/validation";
import { getSession, sessionRef } from "@/lib/pair/sessions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/pair/end — close a session (history retained, resumable read-only).
 * Body: { sessionId: string }.
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

  const { sessionId } = (await req.json()) as { sessionId?: string };
  let safeId: string;
  try {
    safeId = assertDocId(sessionId ?? "", "sessionId");
  } catch {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const db = adminDb();
  const session = await getSession(db, uid, safeId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  await sessionRef(db, uid, safeId).update({
    status: "ended",
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
