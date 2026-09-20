import Parser from "rss-parser";
import type { RawItem } from "./types";

const parser = new Parser({ timeout: 15000 });

async function fetchFeed(url: string, source: RawItem["source"]): Promise<RawItem[]> {
  const feed = await parser.parseURL(url);
  return (feed.items ?? [])
    .filter((i) => i.title && i.link)
    .map((i) => ({
      title: i.title as string,
      url: i.link as string,
      source,
      sourceId: (i.guid as string | undefined) ?? (i.link as string),
      author: i.creator as string | undefined,
      publishedAt: (i.isoDate as string | undefined) ?? undefined,
    }));
}

/** Blogs / newsletters. One bad feed must not kill the whole run. */
export async function fetchRssFeeds(urls: string[]): Promise<RawItem[]> {
  const settled = await Promise.allSettled(urls.map((u) => fetchFeed(u, "rss")));
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/** YouTube channels expose RSS: channel_id from Settings → feed URL. */
export async function fetchYoutubeChannels(channelIds: string[]): Promise<RawItem[]> {
  const urls = channelIds.map(
    (id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${id.trim()}`
  );
  const settled = await Promise.allSettled(urls.map((u) => fetchFeed(u, "youtube")));
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
