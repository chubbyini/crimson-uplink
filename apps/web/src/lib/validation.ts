/** Shared Firestore doc-ID + status validation to stop path injection. */

export const IDEA_STATUSES = ["new", "approved", "skipped", "drafted", "published"] as const;
export const DRAFT_STATUSES = ["pending_review", "approved", "rejected", "published"] as const;

export type IdeaStatusUpdate = (typeof IDEA_STATUSES)[number];
export type DraftStatusUpdate = (typeof DRAFT_STATUSES)[number];

/** Firestore auto-IDs are 20 chars alnum; be permissive but block path escape. */
export function assertDocId(id: string, label = "id"): string {
  const v = (id ?? "").trim();
  if (!v || v.length > 128 || v.includes("/") || v.includes(".") || v.includes("\n")) {
    throw new Error(`Invalid ${label}`);
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new Error(`Invalid ${label}`);
  return v;
}

export function isIdeaStatus(s: unknown): s is IdeaStatusUpdate {
  return typeof s === "string" && (IDEA_STATUSES as readonly string[]).includes(s);
}

export function isDraftStatus(s: unknown): s is DraftStatusUpdate {
  return typeof s === "string" && (DRAFT_STATUSES as readonly string[]).includes(s);
}
