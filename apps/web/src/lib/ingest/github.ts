import type { RawItem } from "./types";

interface GhRepo {
  full_name: string;
  html_url: string;
  description?: string | null;
  stargazers_count?: number;
  created_at?: string;
}

/**
 * Repos created in the last 7 days with 100+ stars, hottest first.
 * Token optional (raises search rate limit from 10/min to 30/min).
 */
export async function fetchTrendingRepos(
  token?: string,
  perPage = 50
): Promise<RawItem[]> {
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(`created:>${since} stars:>100`)}&sort=stars&order=desc&per_page=${perPage}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`);
  const data = (await res.json()) as { items?: GhRepo[] };
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
