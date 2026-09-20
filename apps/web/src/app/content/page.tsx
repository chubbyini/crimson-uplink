"use client";

import { useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { useEffect } from "react";

interface ContentResult {
  topics: string[];
  fetched: number;
  unique: number;
  added: number;
  ideas: Array<{
    id: string;
    title: string;
    angle: string;
    format: string;
    score: number;
    sourceUrls: string[];
  }>;
  draft: { id: string; title: string } | null;
  draftNote?: string;
}

export default function ContentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContentResult | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const list = topics.split("\n").map((t) => t.trim()).filter(Boolean);
    if (!list.length) {
      setError("Enter at least one topic");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/content", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ topics: list }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Content run failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Content run failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Content</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Configure Firebase first (see docs/FIREBASE_SETUP.md).
        </p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Content</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Sign in with Google (top right) to research topics.
        </p>
      </main>
    );
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Content</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Enter topics — searches HN, GitHub, Lobsters, Stack Overflow, Dev.to
        and Medium live, scores ideas with Gemini, and drafts the top one with
        Groq. Results land in your bank too.
      </p>
      <form onSubmit={run} className="mt-6">
        <label className="block text-sm font-medium">
          Topics (one per line)
          <textarea
            rows={3}
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder={"vector databases\nreact server components"}
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-3 flex h-11 items-center rounded-full bg-red-700 px-6 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {busy ? "Researching… (up to a minute)" : "Research topics"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <section className="mt-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Searched {result.fetched} · unique {result.unique} · new{" "}
            {result.added}.
          </p>
          {result.draft ? (
            <p className="mt-2 text-sm text-green-600">
              Draft ready:{" "}
              <Link href="/drafts" className="underline">
                {result.draft.title}
              </Link>
            </p>
          ) : (
            result.draftNote && (
              <p className="mt-2 text-sm text-amber-600">{result.draftNote}</p>
            )
          )}
          <ul className="mt-4 flex flex-col gap-3">
            {result.ideas.map((idea) => (
              <li
                key={idea.id}
                className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono uppercase dark:bg-white/10">
                    {idea.format}
                  </span>
                  <span className="font-mono text-zinc-500">{idea.score}/10</span>
                </div>
                <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                  {idea.title}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {idea.angle}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/ideas" className="underline">
              Open idea bank →
            </Link>
          </p>
        </section>
      )}
    </main>
  );
}
