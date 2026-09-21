"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import type { IdeaStatus, StoredIdea } from "@/lib/ideas/schema";

interface IdeaRow extends StoredIdea {
  id: string;
}

const filters: Array<"all" | IdeaStatus> = ["all", "new", "approved", "skipped", "drafted"];

// Server-side pagination: Firestore only transfers one page per request,
// so the bank holds unlimited ideas while the client stays light.
const PAGE_SIZE = 20;

export default function IdeasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<IdeaRow[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [status, setStatus] = useState<"idle" | "loading" | "scoring" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [tg, setTg] = useState<null | { sent: boolean; reason?: string }>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  async function load(u: User, reset = false, activeFilter: typeof filter = filter) {
    if (!db) return;
    setStatus("loading");
    try {
      // Server-side filter when possible (needs composite index on status+createdAt);
      // fall back to client filter if Firestore rejects the query.
      let snap;
      try {
        const constraints = activeFilter === "all"
          ? [orderBy("createdAt", "desc"), limit(PAGE_SIZE)]
          : [where("status", "==", activeFilter), orderBy("createdAt", "desc"), limit(PAGE_SIZE)];
        const base = query(collection(db, "users", u.uid, "ideas"), ...constraints);
        snap = await getDocs(
          reset || !cursor ? base : query(base, startAfter(cursor))
        );
      } catch {
        const base = query(
          collection(db, "users", u.uid, "ideas"),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE)
        );
        snap = await getDocs(
          reset || !cursor ? base : query(base, startAfter(cursor))
        );
      }
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredIdea) }));
      setRows((rs) => (reset ? docs : [...rs, ...docs]));
      setCursor(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.size === PAGE_SIZE);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ideas");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    void load(user, true);
  }, [user, authLoading, router]);

  async function setIdeaStatus(id: string, s: IdeaStatus) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ideas/status", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ideaId: id, status: s }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update status");

      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: s } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  async function scoreNow() {
    if (!user) return;
    setStatus("scoring");
    setError(null);
    setTg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scoring failed");
      setTg(data.telegram ?? null);
      await load(user, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
      setStatus("error");
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Idea bank</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Configure Firebase first (see docs/FIREBASE_SETUP.md).
        </p>
      </main>
    );
  }
  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Idea bank</h1>
        <p className="mt-4 text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Idea bank</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Sign in with Google (top right) to see your ideas.
        </p>
      </main>
    );
  }

  const visible = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Idea bank</h1>
        <button
          onClick={scoreNow}
          disabled={status === "scoring" || status === "loading"}
          className="flex h-10 items-center rounded-full bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {status === "scoring" ? "Scoring…" : "Score fresh items"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {tg && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {tg.sent ? (
            <>Digest sent to Telegram ✓ — approve from your phone or below.</>
          ) : (
            <>Telegram digest not sent ({tg.reason ?? "not configured"}). You can still approve below.</>
          )}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setCursor(null);
              if (user) void load(user, true, f);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f
                ? "bg-red-700 text-white"
                : "border border-black/10 text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <ul className="mt-6 flex flex-col gap-4">
        {visible.map((idea) => (
          <li
            key={idea.id}
            className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono uppercase dark:bg-white/10">
                {idea.format}
              </span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono dark:bg-white/10">
                {idea.status} · {idea.score}/10
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold">{idea.title}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{idea.angle}</p>
            <p className="mt-2 truncate text-xs text-zinc-500">
              {idea.sourceUrls.join(" · ")}
            </p>
            {idea.status === "new" && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setIdeaStatus(idea.id, "approved")}
                  className="rounded-full bg-red-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                >
                  Approve
                </button>
                <button
                  onClick={() => setIdeaStatus(idea.id, "skipped")}
                  className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Skip
                </button>
              </div>
            )}
            {idea.status === "approved" && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!user) return;
                    setDrafting(idea.id);
                    setError(null);
                    try {
                      const token = await user.getIdToken();
                      const res = await fetch("/api/drafts", {
                        method: "POST",
                        headers: {
                          authorization: `Bearer ${token}`,
                          "content-type": "application/json",
                        },
                        body: JSON.stringify({ ideaId: idea.id }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error ?? "Draft failed");
                      setRows((rs) =>
                        rs.map((r) =>
                          r.id === idea.id ? { ...r, status: "drafted" } : r
                        )
                      );
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Draft failed");
                    } finally {
                      setDrafting(null);
                    }
                  }}
                  disabled={drafting === idea.id}
                  className="rounded-full bg-red-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {drafting === idea.id ? "Drafting…" : "Draft with Groq"}
                </button>
              </div>
            )}
            {idea.status === "drafted" && (
              <p className="mt-3 text-xs text-zinc-500">
                Drafted — see the{" "}
                <Link href="/drafts" className="underline">
                  drafts page
                </Link>
                .
              </p>
            )}
          </li>
        ))}
      </ul>
      {status === "idle" && !visible.length && (
        <p className="mt-6 text-sm text-zinc-500">
          No ideas yet. Run ingest, then Score fresh items.
        </p>
      )}
      {visible.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-xs text-zinc-500">
            Showing {visible.length} loaded ideas
            {filter !== "all" ? ` (filtered: ${filter})` : ""}
            {hasMore ? " — load more for the full bank" : ""}
          </p>
          {hasMore && (
            <button
              onClick={() => user && load(user)}
              disabled={status === "loading"}
              className="rounded-full border border-black/10 px-5 py-2 text-xs font-medium text-slate-700 hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
            >
              {status === "loading" ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
