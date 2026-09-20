export type ItemSource =
  | "hn"
  | "rss"
  | "youtube"
  | "bluesky"
  | "mastodon"
  | "github"
  | "npm"
  | "devto";

export interface RawItem {
  title: string;
  url: string;
  source: ItemSource;
  /** stable id from the origin (HN objectID, RSS guid, YT videoId) */
  sourceId?: string;
  author?: string;
  publishedAt?: string;
  points?: number;
  commentCount?: number;
}

export interface StoredItem extends RawItem {
  hash: string;
  firstSeenAt: string;
  lastSeenAt: string;
}
