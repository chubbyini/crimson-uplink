import type { Firestore } from "firebase-admin/firestore";
import type { CorpusItem } from "./types";
import { urlHash } from "@/lib/ingest/normalize";

/** Ingest user's published articles from Dev.to API. */
export async function fetchDevtoCorpus(devtoKey: string): Promise<Omit<CorpusItem, "id">[]> {
  if (!devtoKey) return [];
  try {
    const res = await fetch("https://dev.to/api/articles/me/published?per_page=30", {
      headers: { "api-key": devtoKey },
    });
    if (!res.ok) return [];
    const articles = (await res.json()) as Array<{
      title?: string;
      body_markdown?: string;
      url?: string;
      published_at?: string;
    }>;

    const now = new Date().toISOString();
    return articles
      .filter((a) => a.title && a.body_markdown)
      .map((a) => {
        const body = a.body_markdown || "";
        return {
          title: a.title || "Dev.to Article",
          source: "devto" as const,
          body,
          url: a.url,
          wordCount: body.split(/\s+/).length,
          createdAt: a.published_at || now,
        };
      });
  } catch (e) {
    console.warn("Dev.to corpus fetch failed:", e);
    return [];
  }
}

/** Ingest READMEs from user's GitHub repositories. */
export async function fetchGithubCorpus(
  githubToken?: string
): Promise<Omit<CorpusItem, "id">[]> {
  if (!githubToken) return [];
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!userRes.ok) return [];
    const userData = (await userRes.json()) as { login?: string };
    if (!userData.login) return [];

    const reposRes = await fetch(
      `https://api.github.com/users/${userData.login}/repos?sort=updated&per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );
    if (!reposRes.ok) return [];
    const repos = (await reposRes.json()) as Array<{ name?: string; html_url?: string }>;

    const items: Omit<CorpusItem, "id">[] = [];
    const now = new Date().toISOString();

    for (const r of repos.slice(0, 5)) {
      if (!r.name) continue;
      try {
        const readmeRes = await fetch(
          `https://api.github.com/repos/${userData.login}/${r.name}/readme`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github.v3.raw",
            },
          }
        );
        if (readmeRes.ok) {
          const body = await readmeRes.text();
          if (body.trim().length > 100) {
            items.push({
              title: `${r.name} README`,
              source: "github" as const,
              body,
              url: r.html_url,
              wordCount: body.split(/\s+/).length,
              createdAt: now,
            });
          }
        }
      } catch {
        // Skip unreadable READMEs
      }
    }
    return items;
  } catch (e) {
    console.warn("GitHub corpus fetch failed:", e);
    return [];
  }
}

export interface CustomArticleInput {
  title?: string;
  content: string;
}

/** Store imported corpus items into users/{uid}/corpus in Firestore. */
export async function storeCorpusItems(
  db: Firestore,
  uid: string,
  items: Omit<CorpusItem, "id">[]
): Promise<{ added: number; total: number }> {
  const capped = items.slice(0, 50).map((i) => ({
    ...i,
    title: (i.title ?? "").slice(0, 300),
    body: (i.body ?? "").slice(0, 60000),
  }));
  const batch = db.batch();
  let added = 0;

  for (const item of capped) {
    let rawId: string;
    try {
      rawId = item.url ? urlHash(item.url) : urlHash(item.title + item.body.slice(0, 50));
    } catch {
      continue;
    }
    try {
      const ref = db.doc(`users/${uid}/corpus/${rawId}`);
      const snap = await ref.get();
      if (!snap.exists) {
        batch.set(ref, { ...item, id: rawId });
        added++;
      }
    } catch {
      continue;
    }
  }

  if (added > 0) {
    await batch.commit();
  }

  const allSnap = await db.collection(`users/${uid}/corpus`).get();
  return { added, total: allSnap.size };
}
