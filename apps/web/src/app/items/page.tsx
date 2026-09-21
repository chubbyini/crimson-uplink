"use client";

import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { PageSkeleton } from "@/components/Skeletons";

interface ItemRow {
  id: string;
  title: string;
  url: string;
  source: string;
  author?: string;
  publishedAt?: string;
  points?: number;
  commentCount?: number;
  firstSeenAt: string;
}

const sources = ["all", "hn", "rss", "youtube", "bluesky", "mastodon", "github", "npm", "devto"];

export default function ItemsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState<"idle" | "loading" | "loading-more" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const PAGE = 100;

  async function loadPage(u: User, reset = false, after: QueryDocumentSnapshot | null = null) {
    if (!db) return;
    setStatus(reset ? "loading" : "loading-more");
    try {
      const base = query(
        collection(db, "users", u.uid, "items"),
        orderBy("lastSeenAt", "desc"),
        limit(PAGE)
      );
      const snap = await getDocs(after ? query(base, startAfter(after)) : base);
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ItemRow, "id">) }));
      setRows((rs) => (reset ? docs : [...rs, ...docs]));
      setCursor(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.size === PAGE);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load items");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!db) return;
    // Auth-gated initial fetch: runs once per sign-in, not per render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows([]);
    setCursor(null);
    setHasMore(true);
    void loadPage(user, true);
  }, [user, authLoading, router]);

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <p className="mt-4 text-slate-400">
          Configure Firebase first (see docs/FIREBASE_SETUP.md).
        </p>
      </main>
    );
  }
  if (authLoading) return <PageSkeleton title="Sources" />;
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <p className="mt-4 text-slate-400">
          Sign in with Google (top right) to see your ingested articles.
        </p>
      </main>
    );
  }

  const visible = rows.filter((r) => filter === "all" || r.source === filter);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="ui-title">Sources</h1>
      <p className="ui-sub">
        {rows.length} articles loaded{hasMore ? " (more available)" : ""}. Run more from Settings → Run ingest
        now.
      </p>
      {status === "loading" && <p className="mt-3 text-sm text-slate-500">Loading sources…</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {sources.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={filter === s ? "chip-active" : "chip"}
          >
            {s}
          </button>
        ))}
      </div>
      <ul className="mt-6 flex flex-col gap-3">
        {visible.map((item) => (
          <li
            key={item.id}
            className="ui-panel p-4"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="meta-pill uppercase">
                {item.source}
              </span>
              {item.points != null && (
                <span className="font-mono text-slate-500">
                  {item.points} pts
                </span>
              )}
              {item.author && (
                <span className="truncate text-slate-500">{item.author}</span>
              )}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block font-medium text-slate-100 hover:underline"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
      {status === "idle" && !visible.length && (
        <p className="mt-6 text-sm text-slate-500">
          Nothing here yet — run ingest from Settings.
        </p>
      )}
      {hasMore && user && (
        <button
          onClick={() => void loadPage(user, false, cursor)}
          disabled={status === "loading-more"}
          className="btn-ghost mt-6"
        >
          {status === "loading-more" ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
