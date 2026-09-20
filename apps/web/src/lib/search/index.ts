import Parser from "rss-parser";
import type { RawItem } from "@/lib/ingest/types";
import { fetchDevtoByTags } from "@/lib/ingest/devto";
import {
  searchGithub,
  searchHn,
  searchLobsters,
  searchStackOverflow,
} from "./query";

const parser = new Parser({ timeout: 15000 });

/** Medium tag RSS: https://medium.com/feed/tag/<slug>. No key needed. */
async function searchMedium(topics: string[]): Promise<RawItem[]> {
  const out: RawItem[] = [];
  for (const topic of topics) {
    const slug = topic.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) continue;
    try {
      const feed = await parser.parseURL(
        `https://medium.com/feed/tag/${encodeURIComponent(slug)}`
      );
      for (const i of feed.items ?? []) {
        if (!i.title || !i.link) continue;
        out.push({
          title: i.title,
          url: (i.link as string).split("?")[0],
          source: "rss",
          sourceId: (i.guid as string | undefined) ?? (i.link as string),
          author: i.creator as string | undefined,
          publishedAt: (i.isoDate as string | undefined) ?? undefined,
        });
      }
    } catch {
      // Unknown tag slug — skip.
    }
  }
  return out;
}

export interface TopicSearchParams {
  topics: string[];
  githubToken?: string;
}

/** Fan out one topic list across every queryable source. Failures are per-source. */
export async function searchTopics({
  topics,
  githubToken,
}: TopicSearchParams): Promise<RawItem[]> {
  const clean = topics.map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return [];

  const tagSlugs = clean.map((t) => t.toLowerCase().replace(/\s+/g, ""));
  const jobs: Array<Promise<RawItem[]>> = [];
  for (const topic of clean) {
    jobs.push(
      searchHn(topic).catch(() => []),
      searchGithub(topic, githubToken).catch(() => []),
      searchLobsters(topic).catch(() => []),
      searchStackOverflow(topic).catch(() => [])
    );
  }
  jobs.push(
    fetchDevtoByTags(tagSlugs).catch(() => []),
    searchMedium(clean).catch(() => [])
  );
  return (await Promise.all(jobs)).flat();
}
