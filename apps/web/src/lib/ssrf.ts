/** SSRF guard: only allow public http(s) URLs, block private/metadata hosts. */

const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  "metadata.google.internal",
  "metadata.google",
];

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [, a, b] = m.map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim().replace(/\.$/, "");
  if (!h) return true;
  if (h === "[::1]" || h === "::1") return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`))) return true;
  if (isPrivateIpv4(h)) return true;
  // Bracketed IPv6 loopback / unique-local / link-local
  if (h.startsWith("[") && h.endsWith("]")) {
    const inner = h.slice(1, -1).toLowerCase();
    if (inner === "::1" || inner.startsWith("fc") || inner.startsWith("fd") || inner.startsWith("fe80")) return true;
  }
  return false;
}

/** True if raw is a public http(s) URL safe to fetch server-side. */
export function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (isBlockedHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Throw if the URL is not safe to fetch. Returns trimmed URL. */
export function assertSafeHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!isSafeHttpUrl(trimmed)) throw new Error(`Blocked unsafe URL: ${trimmed.slice(0, 120)}`);
  return trimmed;
}

/** Validate a user-supplied hostname like a Mastodon instance. */
export function assertSafeHostname(host: string): string {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h || h.length > 253 || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(h)) {
    throw new Error(`Invalid hostname: ${host.slice(0, 80)}`);
  }
  if (isBlockedHost(h)) throw new Error(`Blocked hostname: ${h.slice(0, 80)}`);
  return h;
}

/** fetch with a default timeout (AbortSignal.timeout). */
export async function safeFetch(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const safeUrl = assertSafeHttpUrl(url);
  const signal = init.signal ?? AbortSignal.timeout(timeoutMs);
  return fetch(safeUrl, { ...init, signal });
}
