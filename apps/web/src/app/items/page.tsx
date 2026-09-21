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
    setRows([]);
    setCursor(null);
    setHasMore(true);
    void loadPage(user, true);
  }, [user, authLoading, router]);

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Configure Firebase first (see docs/FIREBASE_SETUP.md).
        </p>
      </main>
    );
  }
  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <p className="mt-4 text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Sign in with Google (top right) to see your ingested articles.
        </p>
      </main>
    );
  }

  const visible = rows.filter((r) => filter === "all" || r.source === filter);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Sources</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {rows.length} articles loaded{hasMore ? " (more available)" : ""}. Run more from Settings → Run ingest
        now.
      </p>
      {status === "loading" && <p className="mt-3 text-sm text-zinc-500">Loading sources…</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {sources.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === s
                ? "bg-red-700 text-white"
                : "border border-black/10 text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <ul className="mt-6 flex flex-col gap-3">
        {visible.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono uppercase dark:bg-white/10">
                {item.source}
              </span>
              {item.points != null && (
                <span className="font-mono text-zinc-500">
                  {item.points} pts
                </span>
              )}
              {item.author && (
                <span className="truncate text-zinc-500">{item.author}</span>
              )}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block font-medium hover:underline"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
      {status === "idle" && !visible.length && (
        <p className="mt-6 text-sm text-zinc-500">
          Nothing here yet — run ingest from Settings.
        </p>
      )}
      {hasMore && user && (
        <button
          onClick={() => void loadPage(user, false, cursor)}
          disabled={status === "loading-more"}
          className="mt-6 rounded-full border border-black/10 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/15"
        >
          {status === "loading-more" ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
