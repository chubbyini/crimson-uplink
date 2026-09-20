import type { Firestore } from "firebase-admin/firestore";
import { runIngest, type RawItem } from "@/lib/ingest";
import { urlHash } from "@/lib/ingest/normalize";
import { scoreIdeas } from "@/lib/ideas/score";
import { sendDigest } from "@/lib/telegram";
import { SettingsSchema, type Settings } from "@/lib/settings";

export interface IngestResult {
  fetched: number;
  unique: number;
  added: number;
  seenBefore: number;
}

export interface StoreResult {
  unique: number;
  added: number;
  seenBefore: number;
}

/** Dedupe-store raw items into users/{uid}/items (hash doc IDs). Shared. */
export async function storeItems(
  db: Firestore,
  uid: string,
  raw: RawItem[],
  extra: Record<string, unknown> = {}
): Promise<StoreResult> {
  const now = new Date().toISOString();
  const refs = new Map<string, RawItem>();
  for (const item of raw) {
    try {
      refs.set(urlHash(item.url), item);
    } catch {
      // Unparseable URL — skip.
    }
  }
  const snaps = refs.size
    ? await db.getAll(...[...refs.keys()].map((h) => db.doc(`users/${uid}/items/${h}`)))
    : [];
  const existing = new Set(snaps.filter((s) => s.exists).map((s) => s.id));

  const batch = db.batch();
  let added = 0;
  for (const [hash, item] of refs) {
    if (existing.has(hash)) {
      batch.set(
        db.doc(`users/${uid}/items/${hash}`),
        { lastSeenAt: now },
        { merge: true }
      );
    } else {
      batch.set(db.doc(`users/${uid}/items/${hash}`), {
        ...item,
        ...extra,
        hash,
        firstSeenAt: now,
        lastSeenAt: now,
      });
      added += 1;
    }
  }
  if (refs.size) await batch.commit();
  return { unique: refs.size, added, seenBefore: refs.size - added };
}

export interface ScoreResult {
  count: number;
  ids: string[];
  telegram: { sent: boolean; reason?: string };
}

/** Pull + dedupe-store items for one user. Shared by /api/ingest and cron. */
export async function ingestForUser(
  db: Firestore,
  uid: string,
  settings: Settings
): Promise<IngestResult> {
  const raw = await runIngest(settings);
  const stored = await storeItems(db, uid, raw);
  return { fetched: raw.length, ...stored };
}

/** Score freshest items into ideas + best-effort Telegram digest. */
export async function scoreForUser(
  db: Firestore,
  uid: string,
  settings: Settings
): Promise<ScoreResult> {
  if (!settings.geminiKey) throw new Error("Add your Gemini API key in Settings first");

  const itemsSnap = await db
    .collection(`users/${uid}/items`)
    .orderBy("lastSeenAt", "desc")
    .limit(100)
    .get();
  const items = itemsSnap.docs
    .map((d) => {
      const v = d.data() as {
        title?: string;
        url?: string;
        source?: string;
        points?: number;
        commentCount?: number;
      };
      return {
        title: v.title ?? "(untitled)",
        url: v.url ?? "",
        source: v.source ?? "rss",
        points: v.points,
        commentCount: v.commentCount,
      };
    })
    .filter((i) => i.url);

  if (!items.length) throw new Error("No items yet — run ingest first");

  let ideas;
  try {
    ideas = await scoreIdeas(settings.geminiKey, items);
  } catch (e) {
    throw new Error(
      e instanceof Error ? `Gemini failed: ${e.message}` : "Gemini failed"
    );
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  const ids = ideas.map((idea) => {
    const ref = db.collection(`users/${uid}/ideas`).doc();
    batch.set(ref, { ...idea, status: "new", createdAt: now });
    return ref.id;
  });
  await batch.commit();

  let telegram: ScoreResult["telegram"] = { sent: false };
  if (settings.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      await sendDigest(
        settings.telegramChatId.trim(),
        uid,
        ideas.map((idea, n) => ({ ...idea, id: ids[n] }))
      );
      telegram = { sent: true };
    } catch (e) {
      telegram = {
        sent: false,
        reason: e instanceof Error ? e.message.split("\n")[0] : "send failed",
      };
    }
  } else {
    telegram = { sent: false, reason: "Telegram not configured" };
  }

  return { count: ideas.length, ids, telegram };
}

export async function loadSettings(db: Firestore, uid: string): Promise<Settings | null> {
  const snap = await db.doc(`users/${uid}/settings/config`).get();
  if (!snap.exists) return null;
  return SettingsSchema.parse(snap.data());
}
