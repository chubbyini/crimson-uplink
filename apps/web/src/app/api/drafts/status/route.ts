import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertDocId, isDraftStatus } from "@/lib/validation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/drafts/status — update draft status or delete if rejected.
 * Body: { draftId: string, status: "pending_review" | "approved" | "rejected" }.
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

  const rate = checkRateLimit(uid, 20, 60000);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again shortly." },
      { status: 429 }
    );
  }

  const { draftId, status } = (await req.json()) as {
    draftId?: string;
    status?: string;
  };
  let safeId: string;
  try {
    safeId = assertDocId(draftId ?? "", "draftId");
  } catch {
    return NextResponse.json({ error: "Invalid draftId" }, { status: 400 });
  }
  if (!isDraftStatus(status) || status === "published") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = adminDb();
  const draftRef = db.doc(`users/${uid}/drafts/${safeId}`);

  if (status === "rejected") {
    await draftRef.delete();
    return NextResponse.json({ success: true, draftId, deleted: true });
  }

  await draftRef.update({ status });
  return NextResponse.json({ success: true, draftId, status });
}
