import type { RawItem } from "./types";

/**
 * Weekly download counts for the user's watchlist packages.
 * URL is bucketed by ISO week so trending packages re-surface weekly
 * instead of deduping forever on the stable npm URL.
 */
export async function fetchNpmPackages(pkgs: string[]): Promise<RawItem[]> {
  const names = pkgs.map((p) => p.trim()).filter(Boolean);
  if (!names.length) return [];
  const res = await fetch(
    `https://api.npmjs.org/downloads/point/last-week/${names.map(encodeURIComponent).join(",")}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`npm API failed: ${res.status}`);
  const data = (await res.json()) as
    | { downloads?: number; package?: string }
    | Record<string, { downloads?: number; package?: string }>;
  const entries =
    "downloads" in data && typeof data.downloads === "number"
      ? [data as { downloads?: number; package?: string }]
      : Object.values(data);
  return entries
    .filter((e) => e.package && typeof e.downloads === "number")
    .map((e) => {
      const week = new Date().toISOString().slice(0, 7);
      // Week-bucketed query param survives normalizeUrl (hash would be stripped),
      // so trending packages re-surface each month instead of deduping forever.
      const base = `https://www.npmjs.com/package/${e.package}?trending=${week}`;
      return {
        title: `${e.package} — ${(e.downloads as number).toLocaleString("en-US")} weekly downloads`,
        url: base,
        source: "npm" as const,
        sourceId: `${e.package}@${week}`,
        points: e.downloads,
      };
    });
}
