import type { Settings } from "@/lib/settings";
import { fetchHnFrontPage } from "./hn";
import { fetchRssFeeds, fetchYoutubeChannels } from "./rss";
import type { RawItem } from "./types";

export type { RawItem };

/** Pull every enabled source for one user. Failures are per-source (see rss.ts). */
export async function runIngest(settings: Settings): Promise<RawItem[]> {
  const [hn, rss, youtube] = await Promise.all([
    fetchHnFrontPage().catch(() => [] as RawItem[]),
    settings.rssFeeds.length ? fetchRssFeeds(settings.rssFeeds) : Promise.resolve([]),
    settings.youtubeChannelIds.length
      ? fetchYoutubeChannels(settings.youtubeChannelIds)
      : Promise.resolve([]),
  ]);
  // Bluesky / Mastodon / GitHub / npm land in commit 6.
  return [...hn, ...rss, ...youtube];
}
