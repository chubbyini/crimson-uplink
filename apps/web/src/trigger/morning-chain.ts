import { logger, schedules, task } from "@trigger.dev/sdk";
import { adminDb, isAdminConfigured } from "../lib/firebase-admin";
import { checkRunIdempotency } from "../lib/idempotency";
import type { StoredIdea } from "../lib/ideas/schema";
import { sendDigest } from "../lib/telegram";
import {
  ingestForUser,
  loadSettings,
  mapWithConcurrency,
  scoreForUser,
  withTimeout,
} from "../lib/pipeline";

/**
 * morning-chain — the full morning run for ALL users with ingest enabled:
 * ingest → score → Telegram digest, per user with their own keys (BYOK).
 *
 * Mirrors GET /api/cron/morning plus the digest step (Step 3), which no
 * scheduler currently invokes. Digest sends are idempotent per runId, so
 * retries and overlapping runs can never double-send.
 */
export const morningChain = task({
  id: "morning-chain",
  maxDuration: 600,
  run: async (payload: { runId?: string } = {}) => {
    if (!isAdminConfigured) {
      throw new Error("Server not configured: FIREBASE_SERVICE_ACCOUNT_JSON missing");
    }
    const runId = payload.runId ?? `${new Date().toISOString().slice(0, 10)}-morning`;
    logger.info("Morning chain started", { runId });

    const db = adminDb();
    const profiles = await db.collection("users").get();

    // Bounded concurrency + per-user isolation: one slow user can't kill the run.
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
        // Digest step: Telegram, idempotent per runId.
        if (settings.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
          const idempotency = await checkRunIdempotency(db, uid, runId, "telegram_digest");
          if (idempotency.isDuplicate) {
            entry.digest = { skipped: true, reason: "Already executed for runId", runId };
          } else {
            const ideasSnap = await db
              .collection(`users/${uid}/ideas`)
              .where("status", "==", "new")
              .orderBy("createdAt", "desc")
              .limit(5)
              .get();
            const ideas = ideasSnap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredIdea) }));
            if (!ideas.length) {
              entry.digest = { sent: false, reason: "No new ideas to digest" };
            } else {
              await withTimeout(
                sendDigest(settings.telegramChatId.trim(), uid, ideas),
                20000,
                `digest:${uid}`
              );
              entry.digest = { sent: true, count: ideas.length, runId };
            }
          }
        } else {
          entry.digest = { skipped: true, reason: "No Telegram chat ID configured" };
        }
      } catch (e) {
        entry.error = e instanceof Error ? e.message.split("\n")[0] : "failed";
      }
      return entry;
    });

    logger.info("Morning chain finished", { runId, users: results.length });
    return { runId, users: results.length, results };
  },
});

/**
 * 05:00 UTC = true 6am WAT year-round (Lagos has no DST) — the Vercel cron
 * this replaces fires at 6am UTC, i.e. 7am Lagos time.
 */
export const morningSchedule = schedules.task({
  id: "morning-schedule",
  cron: "0 5 * * *",
  run: async () => {
    await morningChain.trigger({});
  },
});
