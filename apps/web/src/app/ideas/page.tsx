"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import type { IdeaStatus, StoredIdea } from "@/lib/ideas/schema";

interface IdeaRow extends StoredIdea {
  id: string;
}

const filters: Array<"all" | IdeaStatus> = ["all", "new", "approved", "skipped", "drafted"];

export default function IdeasPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<IdeaRow[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [status, setStatus] = useState<"idle" | "loading" | "scoring" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [tg, setTg] = useState<null | { sent: boolean; reason?: string }>(null);

  async function load(u: User) {
    if (!db) return;
    setStatus("loading");
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", u.uid, "ideas"),
          orderBy("createdAt", "desc"),
          limit(50)
        )
      );
      setRows(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredIdea) }))
      );
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ideas");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) void load(u);
    });
  }, []);

  async function setIdeaStatus(id: string, s: IdeaStatus) {
    if (!user || !db) return;
    await updateDoc(doc(db, "users", user.uid, "ideas", id), { status: s });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: s } : r)));
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
      await load(user);
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
            onClick={() => setFilter(f)}
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
    </main>
  );
}
