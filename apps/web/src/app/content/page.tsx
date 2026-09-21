"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { PageSkeleton } from "@/components/Skeletons";

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
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [topics, setTopics] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContentResult | null>(null);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

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
      toast.success(`Researched ${data.ideas?.length ?? 0} ideas${data.draft ? " + drafted top idea" : ""} ✓`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Content run failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Content</h1>
        <p className="mt-4 text-slate-400">
          Configure Firebase first (see docs/FIREBASE_SETUP.md).
        </p>
      </main>
    );
  }
  if (authLoading) return <PageSkeleton title="Content" rows={2} />;
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Content</h1>
        <p className="mt-4 text-slate-400">
          Sign in with Google (top right) to research topics.
        </p>
      </main>
    );
  }

  const inputCls = "input mt-1";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="ui-title">Content</h1>
      <p className="ui-sub">
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
          className="btn-primary-lg mt-3 flex h-11 items-center"
        >
          {busy ? "Researching… (up to a minute)" : "Research topics"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {result && (
        <section className="mt-8">
          <p className="text-sm text-slate-400">
            Searched {result.fetched} · unique {result.unique} · new{" "}
            {result.added}.
          </p>
          {result.draft ? (
            <p className="mt-2 text-sm text-emerald-400">
              Draft ready:{" "}
              <Link href="/drafts" className="underline">
                {result.draft.title}
              </Link>
            </p>
          ) : (
            result.draftNote && (
              <p className="mt-2 text-sm text-amber-400">{result.draftNote}</p>
            )
          )}
          <ul className="mt-4 flex flex-col gap-3">
            {result.ideas.map((idea) => (
              <li
                key={idea.id}
                className="ui-panel p-4"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="meta-pill uppercase">
                    {idea.format}
                  </span>
                  <span className="font-mono text-slate-500">{idea.score}/10</span>
                </div>
                <p className="mt-1 font-medium text-slate-100">
                  {idea.title}
                </p>
                <p className="mt-1 text-sm text-slate-400">
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
