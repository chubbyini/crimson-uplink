import type { RawItem } from "@/lib/ingest/types";
import { safeFetch } from "@/lib/ssrf";

/** Full-text story search on HN Algolia (up to 50 hits). */
export async function searchHn(topic: string, perTopic = 25): Promise<RawItem[]> {
  const res = await safeFetch(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=50`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    hits?: Array<{
      title?: string;
      url?: string | null;
      author?: string;
      points?: number;
      num_comments?: number;
      created_at?: string;
      objectID: string;
    }>;
  };
  return (data.hits ?? []).slice(0, perTopic).map((h) => ({
    title: h.title ?? "(untitled)",
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: "hn" as const,
    sourceId: h.objectID,
    author: h.author,
    publishedAt: h.created_at,
    points: h.points,
    commentCount: h.num_comments,
  }));
}

/** GitHub repo search by topic, stars first. Token optional. */
export async function searchGithub(
  topic: string,
  token?: string,
  perTopic = 25
): Promise<RawItem[]> {
  const res = await safeFetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}&sort=stars&order=desc&per_page=${perTopic}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{
      full_name: string;
      html_url: string;
      description?: string | null;
      stargazers_count?: number;
      created_at?: string;
    }>;
  };
  return (data.items ?? []).map((r) => ({
    title: r.description
      ? `${r.full_name}: ${r.description}`.slice(0, 200)
      : r.full_name,
    url: r.html_url,
    source: "github" as const,
    sourceId: r.full_name,
    publishedAt: r.created_at,
    points: r.stargazers_count,
  }));
}

/** Lobsters hottest feed, keyword-filtered. No key; Reddit blocks server fetches. */
export async function searchLobsters(topic: string): Promise<RawItem[]> {
  const words = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!words.length) return [];
  const res = await safeFetch("https://lobste.rs/hottest.json");
  if (!res.ok) return [];
  const stories = (await res.json()) as Array<{
    short_id?: string;
    title?: string;
    url?: string;
    score?: number;
    comment_count?: number;
    created_at?: string;
    description_plain?: string;
  }>;
  return stories
    .filter(
      (s) =>
        s.title &&
        s.url &&
        (words.some((w) => s.title!.toLowerCase().includes(w)) ||
          words.some((w) => (s.description_plain ?? "").toLowerCase().includes(w)))
    )
    .slice(0, 20)
    .map((s) => ({
      title: s.title as string,
      url: s.url as string,
      source: "rss" as const,
      sourceId: s.short_id,
      publishedAt: s.created_at,
      points: s.score,
      commentCount: s.comment_count,
    }));
}

/** Stack Overflow advanced search. Free, no key (~300 req/day/IP). */
export async function searchStackOverflow(
  topic: string,
  perTopic = 25
): Promise<RawItem[]> {
  const res = await safeFetch(
    `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=${encodeURIComponent(topic)}&site=stackoverflow&pagesize=${perTopic}&filter=!nNPvSNd7bg`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{
      title?: string;
      link?: string;
      question_id?: number;
      score?: number;
      answer_count?: number;
      creation_date?: number;
    }>;
  };
  return (data.items ?? [])
    .filter((q) => q.title && q.link)
    .map((q) => ({
      title: q.title as string,
      url: q.link as string,
      source: "rss" as const,
      sourceId: String(q.question_id),
      publishedAt: q.creation_date
        ? new Date(q.creation_date * 1000).toISOString()
        : undefined,
      points: q.score,
      commentCount: q.answer_count,
    }));
}
