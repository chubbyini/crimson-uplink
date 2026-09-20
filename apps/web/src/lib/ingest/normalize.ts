import { createHash } from "crypto";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
]);

/** Canonicalize a URL so the same article from two sources hashes equally. */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
  }
  // Drop trailing slash on non-root paths: /a/ and /a are the same article.
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

/** 16-hex-char dedupe key. Throws on unparseable URLs — caller skips those. */
export function urlHash(raw: string): string {
  return createHash("sha256")
    .update(normalizeUrl(raw))
    .digest("hex")
    .slice(0, 16);
}
