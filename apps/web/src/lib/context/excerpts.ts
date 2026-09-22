/**
 * Source-context extraction: read the ORIGINAL articles behind ingested items
 * so scoring and drafting align with what the writers actually said.
 *
 * Two independent angles per URL:
 * - Jina AI Reader (https://r.jina.ai) — high-quality extraction, optional
 *   BYOK key for higher limits, keyless free tier otherwise.
 * - Direct self-extract — zero-dep HTML fetch + tag-strip fallback.
 *
 * Drafts get BOTH angles (cross-check); scoring enrichment uses a single
 * fetch (Jina-first, self fallback) to stay inside time budgets.
 * Everything is best-effort: failures yield partial context, never an error.
 */
import { isSafeHttpUrl, safeFetch } from "@/lib/ssrf";

export type ExcerptVia = "jina" | "self";

export interface SourceExcerpt {
  url: string;
  excerpt: string;
  via: ExcerptVia;
}

const JINA_READER_BASE = "https://r.jina.ai/";
const JINA_TIMEOUT_MS = 20000;
const SELF_TIMEOUT_MS = 12000;
const MAX_HTML_BYTES = 1_500_000;
const MIN_TEXT_CHARS = 200;

/** Cut text at a paragraph (then word) boundary under max. */
export function truncateAtBoundary(text: string, max: number): string {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  const para = t.lastIndexOf("\n\n", max);
  if (para > max * 0.4) return t.slice(0, para).trim();
  const space = t.lastIndexOf(" ", max);
  if (space > max * 0.5) return t.slice(0, space).trim();
  return t.slice(0, max).trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return c > 0 && c < 0x10ffff ? String.fromCodePoint(c) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const c = parseInt(h, 16);
      return c > 0 && c < 0x10ffff ? String.fromCodePoint(c) : "";
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/**
 * Pure HTML -> readable text. Prefers <article>/<main>, else strips
 * nav/header/footer/aside chrome from <body>. No dependencies.
 */
export function extractArticleText(html: string): string {
  let s = html ?? "";
  // Strip comments, scripts, styles, and non-content elements.
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(script|style|noscript|template|svg|canvas|video|audio)[\s\S]*?<\/\1>/gi, " ");

  // Prefer the article/main container when present.
  const container =
    s.match(/<article[\s>][\s\S]*?<\/article\s*>/i)?.[0] ??
    s.match(/<main[\s>][\s\S]*?<\/main\s*>/i)?.[0] ??
    s.match(/<div[^>]*role=["']?main["']?[^>]*>[\s\S]*?<\/div\s*>/i)?.[0];
  if (container) {
    s = container;
  } else {
    // Drop site chrome, keep the rest of the body.
    s = s.replace(/<(nav|header|footer|aside|form|figure|figcaption)[\s>][\s\S]*?<\/\1\s*>/gi, " ");
  }

  // Block elements -> line breaks, then strip remaining tags.
  s = s.replace(/<\/?(p|div|h[1-6]|li|ul|ol|br|tr|blockquote|pre|section|table)[\s>]/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);

  const lines = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Angle A: Jina AI Reader. Key optional (higher limits); keyless = free tier. */
export async function getJinaText(
  rawUrl: string,
  jinaKey?: string,
  maxChars = 4000
): Promise<string> {
  const target = rawUrl.trim();
  if (!isSafeHttpUrl(target)) throw new Error(`Unsafe URL: ${target.slice(0, 80)}`);
  const headers: Record<string, string> = { Accept: "text/plain" };
  const key = jinaKey?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await safeFetch(`${JINA_READER_BASE}${target}`, { headers }, JINA_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Jina ${res.status} for ${target.slice(0, 80)}`);
  const text = truncateAtBoundary(await res.text(), maxChars);
  if (text.length < MIN_TEXT_CHARS) throw new Error("Jina returned too little text");
  return text;
}

/** Angle B: direct fetch + self-extract. Zero deps, fully in our infra. */
export async function getSelfText(rawUrl: string, maxChars = 3000): Promise<string> {
  const target = rawUrl.trim();
  if (!isSafeHttpUrl(target)) throw new Error(`Unsafe URL: ${target.slice(0, 80)}`);
  const res = await safeFetch(target, {}, SELF_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Fetch ${res.status} for ${target.slice(0, 80)}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !/html|text|xml|rss/i.test(contentType)) {
    throw new Error(`Non-HTML content (${contentType.slice(0, 40)})`);
  }
  const html = await res.text();
  if (html.length > MAX_HTML_BYTES) throw new Error("HTML too large");
  const text = truncateAtBoundary(extractArticleText(html), maxChars);
  if (text.length < MIN_TEXT_CHARS) throw new Error("Too little readable text");
  return text;
}

/** Single best excerpt (Jina-first, self fallback) — for the scoring hot path. */
export async function getBestExcerpt(
  url: string,
  jinaKey?: string,
  maxChars = 1500
): Promise<SourceExcerpt> {
  try {
    return { url, excerpt: await getJinaText(url, jinaKey, maxChars), via: "jina" };
  } catch {
    return { url, excerpt: await getSelfText(url, maxChars), via: "self" };
  }
}

export interface EnrichableItem {
  title: string;
  url: string;
  source: string;
  points?: number;
  commentCount?: number;
  excerpt?: string;
  excerptVia?: ExcerptVia;
  excerptAt?: string;
}

const EXCERPT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isExcerptFresh(at?: string): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && Date.now() - t < EXCERPT_TTL_MS;
}

/**
 * Fetch excerpts for the top-N ranked items (points, then order).
 * Bounded concurrency + hard time budget; always resolves with partial
 * results — headline-only scoring is the floor, never a failure.
 */
export async function enrichItemsWithExcerpts<T extends EnrichableItem>(
  items: T[],
  opts: { jinaKey?: string; limit?: number; budgetMs?: number; excerptChars?: number } = {}
): Promise<{ items: T[]; fetched: number; cached: number; keylessJina: boolean }> {
  const { jinaKey, limit = 25, budgetMs = 30000, excerptChars = 1500 } = opts;
  const keylessJina = !jinaKey?.trim();
  const out = items.map((i) => ({ ...i }));
  if (!out.length) return { items: out, fetched: 0, cached: 0, keylessJina };

  const ranked = [...out]
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, limit);

  const deadline = Date.now() + budgetMs;
  let fetched = 0;
  let cached = 0;
  const CONCURRENCY = 3;

  for (let i = 0; i < ranked.length; i += CONCURRENCY) {
    if (Date.now() >= deadline) break;
    const batch = ranked.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        if (item.excerpt?.trim() && isExcerptFresh(item.excerptAt)) {
          cached += 1;
          return;
        }
        if (!isSafeHttpUrl(item.url)) return;
        try {
          const best = await getBestExcerpt(item.url, jinaKey, excerptChars);
          item.excerpt = best.excerpt;
          item.excerptVia = best.via;
          item.excerptAt = new Date().toISOString();
          fetched += 1;
        } catch {
          // Single dead URL never kills enrichment.
        }
      })
    );
  }
  return { items: out, fetched, cached, keylessJina };
}

// --- Draft-stage dual context (Jina AND self, two angles) ---

export interface DualSource {
  url: string;
  jina?: string;
  self?: string;
}

export interface DualContext {
  sources: DualSource[];
  readable: number;
  total: number;
  chars: number;
  keylessJina: boolean;
}

export interface DraftSourceInput {
  url: string;
  excerpt?: string;
  via?: ExcerptVia;
}

/**
 * Build dual-angle context for drafting: for each source URL fetch BOTH the
 * Jina extraction and our direct extraction in parallel. Stored excerpts are
 * reused for their angle; only missing angles are fetched (max 3 sources).
 */
export async function buildDraftContext(
  inputs: DraftSourceInput[],
  opts: { jinaKey?: string; maxSources?: number; jinaChars?: number; selfChars?: number } = {}
): Promise<DualContext> {
  const { jinaKey, maxSources = 3, jinaChars = 4000, selfChars = 3000 } = opts;
  const keylessJina = !jinaKey?.trim();
  const seen = new Set<string>();
  const urls: DraftSourceInput[] = [];
  for (const input of inputs) {
    const url = (input.url ?? "").trim();
    if (!url || seen.has(url) || !isSafeHttpUrl(url)) continue;
    seen.add(url);
    urls.push(input);
    if (urls.length >= maxSources) break;
  }

  const sources: DualSource[] = await Promise.all(
    urls.map(async (input): Promise<DualSource> => {
      const src: DualSource = { url: input.url };
      // Reuse the stored excerpt for whichever angle it already covers.
      if (input.excerpt?.trim()) {
        if (input.via === "self") src.self = truncateAtBoundary(input.excerpt, selfChars);
        else src.jina = truncateAtBoundary(input.excerpt, jinaChars);
      }
      const jobs: Array<Promise<void>> = [];
      if (!src.jina) {
        jobs.push(
          getJinaText(input.url, jinaKey, jinaChars)
            .then((t) => {
              src.jina = t;
            })
            .catch(() => {})
        );
      }
      if (!src.self) {
        jobs.push(
          getSelfText(input.url, selfChars)
            .then((t) => {
              src.self = t;
            })
            .catch(() => {})
        );
      }
      await Promise.all(jobs);
      return src;
    })
  );

  const usable = sources.filter((s) => s.jina || s.self);
  const chars = usable.reduce(
    (n, s) => n + (s.jina?.length ?? 0) + (s.self?.length ?? 0),
    0
  );
  return { sources: usable, readable: usable.length, total: urls.length, chars, keylessJina };
}

/** "Grounded in 2/3 sources · Jina + direct · 9.4k chars" (or unreadable note). */
export function formatContextSummary(ctx: Pick<DualContext, "readable" | "total" | "chars" | "sources">): string {
  if (!ctx.readable) return "Sources unreadable — drafted from headline, please double-check";
  const angles = new Set<ExcerptVia>();
  for (const s of ctx.sources) {
    if (s.jina) angles.add("jina");
    if (s.self) angles.add("self");
  }
  const viaLabel =
    angles.has("jina") && angles.has("self")
      ? "Jina + direct"
      : angles.has("jina")
        ? "Jina"
        : "direct";
  const k = ctx.chars >= 1000 ? `${(ctx.chars / 1000).toFixed(1)}k` : `${ctx.chars}`;
  return `Grounded in ${ctx.readable}/${ctx.total} sources · ${viaLabel} · ${k} chars`;
}

/** Attach stored excerpts to scored ideas (matched by source URL). */
export function attachExcerptsToIdeas<T extends { sourceUrls: string[] }>(
  ideas: T[],
  excerptByUrl: Map<string, SourceExcerpt>
): Array<T & { sourceExcerpts: SourceExcerpt[] }> {
  return ideas.map((idea) => ({
    ...idea,
    sourceExcerpts: idea.sourceUrls
      .map((u) => excerptByUrl.get(u))
      .filter((e): e is SourceExcerpt => Boolean(e?.excerpt)),
  }));
}
