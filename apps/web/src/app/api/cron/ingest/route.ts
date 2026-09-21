import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { ingestForUser, loadSettings } from "@/lib/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/ingest — Chained Cron Step 1: Pull & dedupe fresh items for active users.
 */
export async function GET(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Set CRON_SECRET in server env (see apps/web/.env.example)." },
      { status: 503 }
    );
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = adminDb();
  const usersSnap = await db.collection("users").get();
  const results: Record<string, unknown> = {};

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    try {
      const settings = await loadSettings(db, uid);
      if (!settings || settings.ingestEnabled === false) continue;
      const res = await ingestForUser(db, uid, settings);
      results[uid] = res;
    } catch (e) {
      results[uid] = { error: e instanceof Error ? e.message : "Ingest failed" };
    }
  }

  return NextResponse.json({ step: "ingest", timestamp: new Date().toISOString(), results });
}
