import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertDocId, isIdeaStatus } from "@/lib/validation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ideas/status — update idea status server-side.
 * Body: { ideaId: string, status: IdeaStatus }.
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

  const rate = checkRateLimit(uid, 30, 60000);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again shortly." },
      { status: 429 }
    );
  }

  const { ideaId, status } = (await req.json()) as {
    ideaId?: string;
    status?: string;
  };

  let safeId: string;
  try {
    safeId = assertDocId(ideaId ?? "", "ideaId");
  } catch {
    return NextResponse.json({ error: "Invalid ideaId" }, { status: 400 });
  }
  if (!isIdeaStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = adminDb();
  await db.doc(`users/${uid}/ideas/${safeId}`).update({ status });

  return NextResponse.json({ success: true, ideaId: safeId, status });
}
