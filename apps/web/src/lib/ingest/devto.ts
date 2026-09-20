import type { RawItem } from "./types";

interface DevtoArticle {
  title?: string;
  url?: string;
  user?: { username?: string };
  published_at?: string;
  public_reactions_count?: number;
  comments_count?: number;
}

/** Top articles of the past week per tag. No key needed for public reads. */
export async function fetchDevtoByTags(
  tags: string[],
  perTag = 5
): Promise<RawItem[]> {
  const out: RawItem[] = [];
  for (const tag of tags) {
    const t = tag.trim();
    if (!t) continue;
    try {
      const res = await fetch(
        `https://dev.to/api/articles?tag=${encodeURIComponent(t)}&top=7&per_page=${perTag}`
      );
      if (!res.ok) continue;
      const articles = (await res.json()) as DevtoArticle[];
      for (const a of articles) {
        if (!a.title || !a.url) continue;
        out.push({
          title: a.title,
          url: a.url,
          source: "devto",
          author: a.user?.username,
          publishedAt: a.published_at,
          points: a.public_reactions_count,
          commentCount: a.comments_count,
        });
      }
    } catch {
      // Per-tag failure must not kill the run.
    }
  }
  return out;
}
