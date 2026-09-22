import type { Firestore } from "firebase-admin/firestore";

export type PairPhase = "plan" | "draft" | "critique";
export type PairMode = "series" | "batch";
export type PairArticleStatus = "seed" | "drafting" | "ready" | "shipped";

export interface PairExcerpt {
  url: string;
  excerpt: string;
  via: "jina" | "self";
}

export interface PairArticle {
  id: string;
  title: string;
  format: "linkedin" | "x" | "devto";
  workingBody: string;
  excerpts: PairExcerpt[];
  status: PairArticleStatus;
  ideaId?: string;
  shippedDraftId?: string;
}

export interface PairTurn {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface PairSession {
  title: string;
  mode: PairMode;
  phase: PairPhase;
  articles: PairArticle[];
  activeArticleId: string;
  history: PairTurn[];
  /** Rolling summary of turns older than the live window (history itself is kept). */
  historySummary: string;
  /** How many leading history turns are covered by historySummary. */
  summarizedCount: number;
  critiqueDepth: "deep" | "quick";
  status: "open" | "ended";
  createdAt: string;
  updatedAt: string;
}

export type SeedEntry =
  | { kind: "idea"; ideaId: string }
  | { kind: "draft"; draftId: string }
  | { kind: "blank"; topic: string }
  | { kind: "excerpts"; title: string; material: string }
  | { kind: "paragraph"; title: string; paragraph: string };

export function sessionRef(db: Firestore, uid: string, sessionId: string) {
  return db.doc(`users/${uid}/pair-sessions/${sessionId}`);
}

export async function getSession(
  db: Firestore,
  uid: string,
  sessionId: string
): Promise<(PairSession & { id: string }) | null> {
  const snap = await sessionRef(db, uid, sessionId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as PairSession) };
}

export function activeArticle(session: PairSession): PairArticle | undefined {
  return session.articles.find((a) => a.id === session.activeArticleId);
}

/** Ship working copies to the drafts collection. Returns created draft ids. */
export async function shipArticles(
  db: Firestore,
  uid: string,
  sessionId: string,
  session: PairSession,
  indices: number[]
): Promise<Array<{ articleId: string; draftId: string; title: string }>> {
  const now = new Date().toISOString();
  const out: Array<{ articleId: string; draftId: string; title: string }> = [];
  const batch = db.batch();

  for (const n of indices) {
    const article = session.articles[n];
    if (!article || !article.workingBody.trim() || article.status === "shipped") continue;
    const ref = db.collection(`users/${uid}/drafts`).doc();
    batch.set(ref, {
      title: article.title,
      format: article.format,
      body: article.workingBody,
      model: "pair-writer",
      status: "pending_review",
      createdAt: now,
      pairSessionId: sessionId,
      ...(article.ideaId ? { ideaId: article.ideaId } : {}),
      ...(article.excerpts.length
        ? {
            contextSources: article.excerpts.map((e) => e.url),
            contextChars: article.excerpts.reduce((t, e) => t + e.excerpt.length, 0),
            contextSummary: `Pair-written · ${article.excerpts.length} source${article.excerpts.length === 1 ? "" : "s"}`,
          }
        : {}),
    });
    if (article.ideaId) {
      batch.update(db.doc(`users/${uid}/ideas/${article.ideaId}`), { status: "drafted" });
    }
    article.status = "shipped";
    article.shippedDraftId = ref.id;
    out.push({ articleId: article.id, draftId: ref.id, title: article.title });
  }

  batch.update(sessionRef(db, uid, sessionId), {
    articles: session.articles,
    updatedAt: now,
  });
  await batch.commit();
  return out;
}
