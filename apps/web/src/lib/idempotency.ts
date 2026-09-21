import type { Firestore } from "firebase-admin/firestore";

export interface IdempotencyResult {
  isDuplicate: boolean;
  executedAt?: string;
}

/**
 * Check and record idempotent execution of cron tasks and Telegram digests.
 * Transactional: concurrent callers can't both win.
 */
export async function checkRunIdempotency(
  db: Firestore,
  uid: string,
  runId: string,
  actionKey: string
): Promise<IdempotencyResult> {
  if (!runId || !actionKey || !/^[A-Za-z0-9_-]{1,128}$/.test(runId)) return { isDuplicate: false };

  const ref = db.doc(`users/${uid}/runs/${runId}`);
  const now = new Date().toISOString();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const data = snap.data() || {};
      if (data[actionKey]) {
        return { isDuplicate: true, executedAt: data[actionKey] as string };
      }
      tx.update(ref, { [actionKey]: now });
      return { isDuplicate: false, executedAt: now };
    }
    tx.set(ref, { runId, [actionKey]: now, createdAt: now });
    return { isDuplicate: false, executedAt: now };
  });
  return result;
}
