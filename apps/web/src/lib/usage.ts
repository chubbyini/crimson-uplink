import type { Firestore } from "firebase-admin/firestore";

const DAILY_LLM_CAP = Number(process.env.DAILY_LLM_CAP ?? 50);

/** Simple per-user daily LLM call counter (score/draft). Returns true if allowed. */
export async function checkDailyLlmCap(db: Firestore, uid: string, cost = 1): Promise<{ allowed: boolean; used: number; cap: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`users/${uid}/usage/${day}`);
  const snap = await ref.get();
  const used = Number((snap.data() as { llmCalls?: number } | undefined)?.llmCalls ?? 0);
  if (used + cost > DAILY_LLM_CAP) return { allowed: false, used, cap: DAILY_LLM_CAP };
  return { allowed: true, used, cap: DAILY_LLM_CAP };
}

export async function recordLlmUsage(db: Firestore, uid: string, cost = 1): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`users/${uid}/usage/${day}`);
  try {
    const snap = await ref.get();
    const prev = Number((snap.data() as { llmCalls?: number } | undefined)?.llmCalls ?? 0);
    await ref.set(
      { llmCalls: prev + cost, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {
    // Usage telemetry must never block the main flow.
  }
}
