import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { ingestForUser, loadSettings, mapWithConcurrency, scoreForUser, withTimeout } from "@/lib/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/morning — scheduled morning run for ALL users with ingest
 * enabled. Loops users/{uid}/settings, runs ingest → ideas → digest per user
 * with that user's own keys (BYOK).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
 * when CRON_SECRET is set in the project env. Manual trigger: same header.
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
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (token !== secret) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = adminDb();

  // Users registry: users/{uid}/profile docs written on Settings save.
  // (Avoids firebase-admin/auth listUsers, whose ESM chain breaks some runtimes.)
  // Bounded concurrency + per-user timeout: one slow user can't kill the run.
  const profiles = await db.collection("users").get();
  const results = await mapWithConcurrency(profiles.docs, 2, async (doc) => {
    const uid = doc.id;
    const entry: Record<string, unknown> = { uid };
    try {
      const settings = await loadSettings(db, uid);
      if (!settings || !settings.ingestEnabled) {
        entry.skipped = settings ? "ingest disabled" : "no settings";
        return entry;
      }
      entry.ingest = await withTimeout(ingestForUser(db, uid, settings), 45000, `ingest:${uid}`);
      try {
        const topics = [...(settings.devtoTags ?? []), ...(settings.npmPackages ?? [])].slice(0, 8);
        entry.ideas = await withTimeout(scoreForUser(db, uid, settings, topics), 50000, `score:${uid}`);
      } catch (e) {
        entry.ideasError = e instanceof Error ? e.message : "scoring failed";
      }
    } catch (e) {
      entry.error = e instanceof Error ? e.message.split("\n")[0] : "failed";
    }
    return entry;
  });

  return NextResponse.json({ users: results.length, results });
}
