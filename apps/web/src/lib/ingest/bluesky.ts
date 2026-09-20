import type { RawItem } from "./types";

async function resolveHandle(handle: string): Promise<string | null> {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return null;
  try {
    const res = await fetch(
      `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(h)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { did?: string };
    return data.did ?? null;
  } catch {
    return null;
  }
}

interface BskyFeedItem {
  post?: {
    uri?: string;
    author?: { handle?: string };
    record?: { text?: string; createdAt?: string };
  };
}

/**
 * Recent posts from followed accounts via the PUBLIC AppView — no login or
 * App Password needed for reading public profiles.
 */
export async function fetchBlueskyAccounts(
  handles: string[],
  perAccount = 10
): Promise<RawItem[]> {
  const out: RawItem[] = [];
  for (const handle of handles) {
    try {
      const did = await resolveHandle(handle);
      if (!did) continue;
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}&limit=${perAccount}`
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { feed?: BskyFeedItem[] };
      for (const entry of data.feed ?? []) {
        const post = entry.post;
        const text = post?.record?.text?.trim();
        if (!post?.uri || !text) continue;
        const m = post.uri.match(/^at:\/\/([^/]+)\/[^/]+\/(.+)$/);
        out.push({
          title: text.length > 140 ? text.slice(0, 137) + "…" : text,
          url: m
            ? `https://bsky.app/profile/${m[1]}/post/${m[2]}`
            : post.uri,
          source: "bluesky",
          sourceId: post.uri,
          author: post.author?.handle ?? handle,
          publishedAt: post.record?.createdAt,
        });
      }
    } catch {
      // Per-account failure must not kill the run.
    }
  }
  return out;
}
