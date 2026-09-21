import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase-admin";
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
  let pageToken: string | undefined;

  // listUsers paginates (1000/page) — plenty for MVP scale.
  do {
    const page = await adminAuth().listUsers(1000, pageToken);
    for (const u of page.users) {
      const entry: Record<string, unknown> = { uid: u.uid };
      try {
        const settings = await loadSettings(db, u.uid);
        if (!settings || !settings.ingestEnabled) {
          entry.skipped = settings ? "ingest disabled" : "no settings";
          results.push(entry);
          continue;
        }
        entry.ingest = await ingestForUser(db, u.uid, settings);
        try {
          entry.ideas = await scoreForUser(db, u.uid, settings);
        } catch (e) {
          entry.ideasError = e instanceof Error ? e.message : "scoring failed";
        }
      } catch (e) {
        entry.error = e instanceof Error ? e.message.split("\n")[0] : "failed";
      }
      results.push(entry);
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return NextResponse.json({ users: results.length, results });
}
