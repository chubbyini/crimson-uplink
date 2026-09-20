import type { Settings } from "@/lib/settings";
import { fetchBlueskyAccounts } from "./bluesky";
import { fetchDevtoByTags } from "./devto";
import { fetchTrendingRepos } from "./github";
import { fetchHnFrontPage } from "./hn";
import { fetchMastodonAccounts } from "./mastodon";
import { fetchNpmPackages } from "./npm";
import { fetchRssFeeds, fetchYoutubeChannels } from "./rss";
import type { RawItem } from "./types";

export type { RawItem };

/** Pull every enabled source for one user. Failures are per-source. */
export async function runIngest(settings: Settings): Promise<RawItem[]> {
  const [hn, rss, youtube, bluesky, mastodon, github, npm, devto] =
    await Promise.all([
      fetchHnFrontPage().catch(() => [] as RawItem[]),
      settings.rssFeeds.length ? fetchRssFeeds(settings.rssFeeds) : Promise.resolve([]),
      settings.youtubeChannelIds.length
        ? fetchYoutubeChannels(settings.youtubeChannelIds)
        : Promise.resolve([]),
      settings.blueskyHandles.length
        ? fetchBlueskyAccounts(settings.blueskyHandles)
        : Promise.resolve([]),
      settings.mastodonHandles.length
        ? fetchMastodonAccounts(settings.mastodonHandles)
        : Promise.resolve([]),
      fetchTrendingRepos(settings.githubToken || undefined).catch(
        () => [] as RawItem[]
      ),
      settings.npmPackages.length
        ? fetchNpmPackages(settings.npmPackages).catch(() => [] as RawItem[])
        : Promise.resolve([]),
      settings.devtoTags.length
        ? fetchDevtoByTags(settings.devtoTags)
        : Promise.resolve([]),
    ]);
  return [...hn, ...rss, ...youtube, ...bluesky, ...mastodon, ...github, ...npm, ...devto];
}
