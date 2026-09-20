import type { RawItem } from "./types";

interface MastoStatus {
  id: string;
  url?: string | null;
  content?: string;
  created_at?: string;
  account?: { username?: string };
}

const stripHtml = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Recent public posts from followed accounts. Handles look like
 * `@user@instance`. No token needed — account lookup + public statuses are
 * open on most instances.
 */
export async function fetchMastodonAccounts(
  handles: string[],
  perAccount = 25
): Promise<RawItem[]> {
  const out: RawItem[] = [];
  for (const raw of handles) {
    try {
      const clean = raw.replace(/^@/, "").trim();
      const at = clean.lastIndexOf("@");
      if (at <= 0) continue;
      const user = clean.slice(0, at);
      const instance = clean.slice(at + 1);
      if (!user || !instance) continue;

      const lookup = await fetch(
        `https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(user)}`
      );
      if (!lookup.ok) continue;
      const account = (await lookup.json()) as { id?: string };
      if (!account.id) continue;

      const res = await fetch(
        `https://${instance}/api/v1/accounts/${account.id}/statuses?limit=${perAccount}&exclude_replies=true`
      );
      if (!res.ok) continue;
      const statuses = (await res.json()) as MastoStatus[];
      for (const s of statuses) {
        const text = stripHtml(s.content ?? "");
        if (!s.url || !text) continue;
        out.push({
          title: text.length > 140 ? text.slice(0, 137) + "…" : text,
          url: s.url,
          source: "mastodon",
          sourceId: `${instance}:${s.id}`,
          author: s.account?.username ? `@${s.account.username}@${instance}` : raw,
          publishedAt: s.created_at,
        });
      }
    } catch {
      // Per-account failure must not kill the run.
    }
  }
  return out;
}
