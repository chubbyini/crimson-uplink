import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { loadSettings, scoreForUser } from "@/lib/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/score — Chained Cron Step 2: Score fresh items into ideas with Gemini AI.
 */
export async function GET(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
  }

  const db = adminDb();
  const usersSnap = await db.collection("users").get();
  const results: Record<string, unknown> = {};

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    try {
      const settings = await loadSettings(db, uid);
      if (!settings || !settings.geminiKey) continue;
      const res = await scoreForUser(db, uid, settings);
      results[uid] = res;
    } catch (e) {
      results[uid] = { error: e instanceof Error ? e.message : "Scoring failed" };
    }
  }

  return NextResponse.json({ step: "score", timestamp: new Date().toISOString(), results });
}
