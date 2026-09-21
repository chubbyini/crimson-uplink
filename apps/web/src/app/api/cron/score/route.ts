import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { loadSettings, mapWithConcurrency, scoreForUser, withTimeout } from "@/lib/pipeline";

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
  const entries = await mapWithConcurrency(usersSnap.docs, 2, async (doc) => {
    const uid = doc.id;
    try {
      const settings = await loadSettings(db, uid);
      if (!settings || !settings.geminiKey) return [uid, { skipped: true }] as const;
      const topics = [...(settings.devtoTags ?? []), ...(settings.npmPackages ?? [])].slice(0, 8);
      const res = await withTimeout(scoreForUser(db, uid, settings, topics), 50000, `score:${uid}`);
      return [uid, res] as const;
    } catch (e) {
      return [uid, { error: e instanceof Error ? e.message : "Scoring failed" }] as const;
    }
  });
  const results: Record<string, unknown> = Object.fromEntries(entries);

  return NextResponse.json({ step: "score", timestamp: new Date().toISOString(), results });
}
