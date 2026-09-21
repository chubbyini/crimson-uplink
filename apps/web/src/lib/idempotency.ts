import type { Firestore } from "firebase-admin/firestore";

export interface IdempotencyResult {
  isDuplicate: boolean;
  executedAt?: string;
}

/**
 * Check and record idempotent execution of cron tasks and Telegram digests.
 */
export async function checkRunIdempotency(
  db: Firestore,
  uid: string,
  runId: string,
  actionKey: string
): Promise<IdempotencyResult> {
  if (!runId || !actionKey) return { isDuplicate: false };

  const ref = db.doc(`users/${uid}/runs/${runId}`);
  const snap = await ref.get();
  const now = new Date().toISOString();

  if (snap.exists) {
    const data = snap.data() || {};
    if (data[actionKey]) {
      return { isDuplicate: true, executedAt: data[actionKey] as string };
    }
    await ref.update({ [actionKey]: now });
    return { isDuplicate: false, executedAt: now };
  }

  await ref.set({ runId, [actionKey]: now, createdAt: now });
  return { isDuplicate: false, executedAt: now };
}
