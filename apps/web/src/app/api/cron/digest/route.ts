import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { loadSettings, mapWithConcurrency, withTimeout } from "@/lib/pipeline";
import { sendDigest } from "@/lib/telegram";
import { checkRunIdempotency } from "@/lib/idempotency";
import type { StoredIdea } from "@/lib/ideas/schema";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/digest — Chained Cron Step 3: Send Telegram digests with run ID idempotency.
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

  const url = new URL(req.url);
  const runId = url.searchParams.get("runId") || `${new Date().toISOString().slice(0, 10)}-morning`;

  const db = adminDb();
  const usersSnap = await db.collection("users").get();
  const entries = await mapWithConcurrency(usersSnap.docs, 3, async (doc) => {
    const uid = doc.id;
    try {
      const settings = await loadSettings(db, uid);
      if (!settings?.telegramChatId || !process.env.TELEGRAM_BOT_TOKEN) return [uid, { skipped: true }] as const;

      // Idempotency check: prevent duplicate Telegram digests for the same run ID
      const idempotency = await checkRunIdempotency(db, uid, runId, "telegram_digest");
      if (idempotency.isDuplicate) {
        return [uid, { skipped: true, reason: "Already executed for runId", runId }] as const;
      }

      const ideasSnap = await db
        .collection(`users/${uid}/ideas`)
        .where("status", "==", "new")
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      const ideas = ideasSnap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredIdea) }));
      if (!ideas.length) {
        return [uid, { sent: false, reason: "No new ideas to digest" }] as const;
      }

      await withTimeout(sendDigest(settings.telegramChatId.trim(), uid, ideas), 20000, `digest:${uid}`);
      return [uid, { sent: true, count: ideas.length, runId }] as const;
    } catch (e) {
      return [uid, { error: e instanceof Error ? e.message : "Digest failed" }] as const;
    }
  });
  const results: Record<string, unknown> = Object.fromEntries(entries);

  return NextResponse.json({ step: "digest", runId, timestamp: new Date().toISOString(), results });
}
