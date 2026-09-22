import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/pair — list pair sessions (summaries, no full history).
 * Query: ?id=<sessionId> returns one full session.
 * Query: ?cursor=<updatedAt ISO>&limit=<n> paginates (default 20, max 50).
 */
export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }
    const snap = await adminDb().doc(`users/${uid}/pair-sessions/${id}`).get();
    if (!snap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json({ id: snap.id, ...snap.data() });
  }

  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50);
  const cursor = url.searchParams.get("cursor") || null;

  const snap = await (() => {
    let q = adminDb()
      .collection(`users/${uid}/pair-sessions`)
      .orderBy("updatedAt", "desc")
      .limit(limit);
    if (cursor) q = q.startAfter(cursor) as typeof q;
    return q.get();
  })();

  const sessions = snap.docs.map((d) => {
    const v = d.data() as {
      title?: string;
      mode?: string;
      phase?: string;
      status?: string;
      updatedAt?: string;
      articles?: Array<{ title?: string; status?: string }>;
    };
    return {
      id: d.id,
      title: v.title ?? "(untitled)",
      mode: v.mode ?? "series",
      phase: v.phase ?? "plan",
      status: v.status ?? "open",
      updatedAt: v.updatedAt ?? "",
      articleCount: v.articles?.length ?? 0,
    };
  });
  const last = sessions[sessions.length - 1];
  return NextResponse.json({
    sessions,
    nextCursor: snap.docs.length === limit && last ? last.updatedAt : null,
  });
}

/**
 * DELETE /api/pair — permanently delete a session (shipped drafts are kept).
 * Body: { sessionId: string }.
 */
export async function DELETE(req: Request) {
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

  const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (!sessionId || !/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  await adminDb().doc(`users/${uid}/pair-sessions/${sessionId}`).delete();
  return NextResponse.json({ ok: true });
}
