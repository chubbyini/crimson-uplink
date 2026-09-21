import type { RawItem } from "./types";

/**
 * Weekly download counts for the user's watchlist packages.
 * Stable package URLs dedupe after the first run — new packages you add
 * surface once as idea candidates.
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
    .map((e) => ({
      title: `${e.package} — ${(e.downloads as number).toLocaleString("en-US")} weekly downloads`,
      url: `https://www.npmjs.com/package/${e.package}`,
      source: "npm" as const,
      sourceId: e.package,
      points: e.downloads,
    }));
}
