import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { ingestForUser, loadSettings, scoreForUser } from "@/lib/pipeline";

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
  const results: Array<Record<string, unknown>> = [];

  // Users registry: users/{uid}/profile docs written on Settings save.
  // (Avoids firebase-admin/auth listUsers, whose ESM chain breaks some runtimes.)
  const profiles = await db.collection("users").get();
  for (const doc of profiles.docs) {
    const uid = doc.id;
    const entry: Record<string, unknown> = { uid };
    try {
      const settings = await loadSettings(db, uid);
      if (!settings || !settings.ingestEnabled) {
        entry.skipped = settings ? "ingest disabled" : "no settings";
        results.push(entry);
        continue;
      }
      entry.ingest = await ingestForUser(db, uid, settings);
      try {
        entry.ideas = await scoreForUser(db, uid, settings);
      } catch (e) {
        entry.ideasError = e instanceof Error ? e.message : "scoring failed";
      }
    } catch (e) {
      entry.error = e instanceof Error ? e.message.split("\n")[0] : "failed";
    }
    results.push(entry);
  }

  return NextResponse.json({ users: results.length, results });
}
