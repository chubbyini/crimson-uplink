import type { RawItem } from "./types";

interface HnHit {
  title?: string;
  url?: string | null;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  objectID: string;
}

/** Hacker News front page via the free Algolia API. No key needed. */
export async function fetchHnFrontPage(limit = 30): Promise<RawItem[]> {
  const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page", {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HN Algolia API failed: ${res.status}`);
  const data = (await res.json()) as { hits?: HnHit[] };
  return (data.hits ?? []).slice(0, limit).map((h) => ({
    title: h.title ?? "(untitled)",
    url:
      h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: "hn" as const,
    sourceId: h.objectID,
    author: h.author,
    publishedAt: h.created_at,
    points: h.points,
    commentCount: h.num_comments,
  }));
}
