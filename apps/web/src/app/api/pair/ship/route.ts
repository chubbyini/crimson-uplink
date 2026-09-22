import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertDocId } from "@/lib/validation";
import { getSession, shipArticles } from "@/lib/pair/sessions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/pair/ship — ship working copies to drafts.
 * Body: { sessionId: string, indices?: number[] } (default: all unshipped).
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

  const rate = checkRateLimit(`pair:${uid}`, 10, 60000);
  if (!rate.success) {
    return NextResponse.json({ error: "Rate limit exceeded. Please try again shortly." }, { status: 429 });
  }

  const { sessionId, indices } = (await req.json()) as { sessionId?: string; indices?: number[] };
  let safeId: string;
  try {
    safeId = assertDocId(sessionId ?? "", "sessionId");
  } catch {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const db = adminDb();
  const session = await getSession(db, uid, safeId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const wanted =
    Array.isArray(indices) && indices.length
      ? indices.filter((n) => Number.isInteger(n) && n >= 0 && n < session.articles.length)
      : session.articles.map((_, i) => i);
  const shipped = await shipArticles(db, uid, safeId, session, wanted);
  if (!shipped.length) {
    return NextResponse.json(
      { error: "Nothing to ship — working copies are empty or already shipped." },
      { status: 400 }
    );
  }
  const fresh = await getSession(db, uid, safeId);
  return NextResponse.json({ ok: true, shipped, session: fresh ?? session });
}
