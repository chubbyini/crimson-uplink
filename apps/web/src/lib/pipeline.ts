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

function cleanDoc<T extends Record<string, unknown>>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as T;
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

  // Chunk db.getAll to max 250 references per call
  const allHashes = [...refs.keys()];
  const existing = new Set<string>();
  const GET_CHUNK = 250;
  for (let i = 0; i < allHashes.length; i += GET_CHUNK) {
    const chunk = allHashes.slice(i, i + GET_CHUNK);
    const snaps = await db.getAll(...chunk.map((h) => db.doc(`users/${uid}/items/${h}`)));
    for (const snap of snaps) {
      if (snap.exists) existing.add(snap.id);
    }
  }

  // Chunk batch writes to max 400 operations (Firestore batch max is 500)
  const BATCH_CHUNK = 400;
  const entries = [...refs.entries()];
  let added = 0;

  for (let i = 0; i < entries.length; i += BATCH_CHUNK) {
    const chunk = entries.slice(i, i + BATCH_CHUNK);
    const batch = db.batch();
    for (const [hash, item] of chunk) {
      const docRef = db.doc(`users/${uid}/items/${hash}`);
      if (existing.has(hash)) {
        batch.set(
          docRef,
          cleanDoc({ lastSeenAt: now }),
          { merge: true }
        );
      } else {
        const itemDoc = cleanDoc({
          ...item,
          ...extra,
          hash,
          firstSeenAt: now,
          lastSeenAt: now,
        });
        batch.set(docRef, itemDoc);
        added += 1;
      }
    }
    await batch.commit();
  }

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
    batch.set(ref, cleanDoc({ ...idea, status: "new", createdAt: now }));
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

import { decryptSettingsSecrets } from "@/lib/crypto";

export async function loadSettings(db: Firestore, uid: string): Promise<Settings | null> {
  const snap = await db.doc(`users/${uid}/settings/config`).get();
  if (!snap.exists) return null;
  const rawData = snap.data() || {};
  const decrypted = decryptSettingsSecrets(rawData);
  return SettingsSchema.parse(decrypted);
}
