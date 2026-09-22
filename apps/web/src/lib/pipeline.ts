import type { Firestore } from "firebase-admin/firestore";
import { runIngest, type RawItem } from "@/lib/ingest";
import { urlHash } from "@/lib/ingest/normalize";
import { scoreIdeas, type ScorableItem } from "@/lib/ideas/score";
import type { Idea } from "@/lib/ideas/schema";
import {
  attachExcerptsToIdeas,
  enrichItemsWithExcerpts,
  type SourceExcerpt,
} from "@/lib/context/excerpts";
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

export interface EnrichAndScoreResult<T = ScorableItem> {
  ideas: Array<Idea & { sourceExcerpts: SourceExcerpt[] }>;
  enrichedItems: T[];
  fetched: number;
  cached: number;
  keylessJina: boolean;
}

/**
 * Shared scoring path (cron, /ingest, /topics): read article excerpts for the
 * top candidates, score with Gemini (angles reflect the originals), and carry
 * excerpts forward on each idea for draft grounding.
 */
export async function enrichAndScore<T extends ScorableItem>(
  geminiKey: string,
  jinaKey: string | undefined,
  items: T[],
  topics?: string[],
  opts: { enrichBudgetMs?: number } = {}
): Promise<EnrichAndScoreResult<T>> {
  const enriched = await enrichItemsWithExcerpts(items, {
    jinaKey,
    limit: 25,
    budgetMs: opts.enrichBudgetMs ?? 30000,
  });
  const ideas = await scoreIdeas(geminiKey, enriched.items, topics);
  const excerptByUrl = new Map<string, SourceExcerpt>();
  for (const item of enriched.items) {
    if (item.excerpt?.trim()) {
      excerptByUrl.set(item.url, {
        url: item.url,
        excerpt: item.excerpt.slice(0, 2000),
        via: item.excerptVia ?? "self",
      });
    }
  }
  return {
    ideas: attachExcerptsToIdeas(ideas, excerptByUrl),
    enrichedItems: enriched.items,
    fetched: enriched.fetched,
    cached: enriched.cached,
    keylessJina: enriched.keylessJina,
  };
}

/** Score freshest items into ideas + best-effort Telegram digest. */
export async function scoreForUser(
  db: Firestore,
  uid: string,
  settings: Settings,
  topics?: string[],
  opts: { enrichBudgetMs?: number } = {}
): Promise<ScoreResult> {
  if (!settings.geminiKey) throw new Error("Add your Gemini API key in Settings first");

  const itemsSnap = await db
    .collection(`users/${uid}/items`)
    .orderBy("lastSeenAt", "desc")
    .limit(100)
    .get();
  const docs = itemsSnap.docs
    .map((d) => {
      const v = d.data() as {
        title?: string;
        url?: string;
        source?: string;
        points?: number;
        commentCount?: number;
        excerpt?: string;
        excerptVia?: "jina" | "self";
        excerptAt?: string;
      };
      return { ref: d.ref, v };
    })
    .filter((x) => x.v.url);
  const items = docs.map((x) => ({
    title: x.v.title ?? "(untitled)",
    url: x.v.url as string,
    source: x.v.source ?? "rss",
    points: x.v.points,
    commentCount: x.v.commentCount,
    excerpt: x.v.excerpt,
    excerptVia: x.v.excerptVia,
    excerptAt: x.v.excerptAt,
  }));

  if (!items.length) throw new Error("No items yet — run ingest first");

  let ideas: EnrichAndScoreResult["ideas"];
  try {
    const scored = await enrichAndScore(
      settings.geminiKey,
      settings.jinaKey || undefined,
      items,
      topics,
      { enrichBudgetMs: opts.enrichBudgetMs }
    );
    ideas = scored.ideas;

    // Write back freshly fetched excerpts so later runs reuse the cache.
    const before = new Map(docs.map((x) => [x.v.url as string, x.v.excerptAt]));
    const wb = db.batch();
    let writes = 0;
    for (const item of scored.enrichedItems) {
      if (!item.excerpt || before.get(item.url) === item.excerptAt) continue;
      const doc = docs.find((x) => x.v.url === item.url)?.ref;
      if (!doc) continue;
      wb.set(
        doc,
        cleanDoc({
          excerpt: item.excerpt,
          excerptVia: item.excerptVia ?? "self",
          excerptAt: item.excerptAt,
        }),
        { merge: true }
      );
      writes += 1;
    }
    if (writes) await wb.commit();
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
  const parsed = SettingsSchema.safeParse(decrypted);
  if (!parsed.success) {
    console.error(`[settings] corrupt doc for ${uid}:`, parsed.error.issues.slice(0, 3));
    // Return defaults merged with any valid keys so one bad field can't 500 every route.
    const fallback = SettingsSchema.safeParse({});
    return fallback.success ? fallback.data : null;
  }
  return parsed.data;
}

/** Run async jobs with bounded concurrency (cron fan-out safety). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Reject if fn takes longer than ms (per-user cron timeout). */
export async function withTimeout<T>(fn: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
