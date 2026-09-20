"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { IdeaStatus } from "@/lib/ideas/schema";

interface NewIdea {
  id: string;
  title: string;
  format: string;
  score: number;
  status: IdeaStatus;
}

interface PipeResult {
  ingest?: { fetched: number; unique: number; added: number; seenBefore: number };
  ideas?: { count: number };
  telegram?: { sent: boolean; reason?: string };
  error?: string;
}

/** Authenticated home: pipeline status, one-tap run, newest ideas to triage. */
export default function Dashboard({ user }: { user: User }) {
  const [counts, setCounts] = useState({ items: 0, ideas: 0, drafts: 0, publishes: 0 });
  const [fresh, setFresh] = useState<NewIdea[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!db) return;
    const base = (name: string) => collection(db!, "users", user.uid, name);
    const [items, ideas, drafts, publishes, newest] = await Promise.all([
      getCountFromServer(base("items")),
      getCountFromServer(base("ideas")),
      getCountFromServer(query(base("drafts"), where("status", "==", "pending_review"))),
      getCountFromServer(base("publishes")),
      getDocs(query(base("ideas"), orderBy("createdAt", "desc"), limit(5))),
    ]);
    setCounts({
      items: items.data().count,
      ideas: ideas.data().count,
      drafts: drafts.data().count,
      publishes: publishes.data().count,
    });
    setFresh(
      newest.docs
        .map((d) => {
          const v = d.data() as {
            title: string;
            format: string;
            score: number;
            status: IdeaStatus;
          };
          return { id: d.id, title: v.title, format: v.format, score: v.score, status: v.status };
        })
        .filter((r) => r.status === "new")
    );
  }, [user.uid]);

  // Initial data load on mount (canonical fetch-on-mount; the React 19
  // set-state-in-effect rule is silenced for this line deliberately).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load dashboard")
    );
  }, [refresh]);

  async function triage(id: string, s: "approved" | "skipped") {
    if (!db) return;
    await updateDoc(doc(db, "users", user.uid, "ideas", id), { status: s });
    setFresh((rs) => rs.filter((r) => r.id !== id));
  }

  async function runPipeline() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const authHeader = { authorization: `Bearer ${token}` };
      const ing = await fetch("/api/ingest", { method: "POST", headers: authHeader });
      const ingData = await ing.json();
      if (!ing.ok) throw new Error(ingData.error ?? "Ingest failed");
      const sc = await fetch("/api/ideas", { method: "POST", headers: authHeader });
      const scData = await sc.json();
      if (!sc.ok) throw new Error(scData.error ?? "Scoring failed");
      setResult({ ingest: ingData, ideas: scData, telegram: scData.telegram });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pipeline failed");
    } finally {
      setRunning(false);
    }
  }

  const cards = [
    { label: "ARTICLES", value: counts.items, href: "/items" },
    { label: "IDEAS BANKED", value: counts.ideas, href: "/ideas" },
    { label: "DRAFTS PENDING", value: counts.drafts, href: "/drafts" },
    { label: "PUBLISHED", value: counts.publishes, href: "/analytics" },
  ];

  return (
    <main className="w-full px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-sky-400">
              Mission control
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">
              Morning pipeline
            </h1>
          </div>
          <button
            onClick={runPipeline}
            disabled={running}
            className="flex h-11 items-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 font-mono text-sm font-bold text-white shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:from-sky-400 hover:to-blue-500 active:scale-95 disabled:opacity-50"
          >
            {running ? "RUNNING…" : "▶ RUN FULL PIPELINE"}
          </button>
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {result && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300">
            Ingested {result.ingest?.added} new ({result.ingest?.fetched} fetched) ·{" "}
            {result.ideas?.count} ideas scored ·{" "}
            {result.telegram?.sent ? (
              <span className="text-emerald-400">digest sent to Telegram ✓</span>
            ) : (
              <span className="text-amber-400">
                digest not sent ({result.telegram?.reason ?? "see /ideas"})
              </span>
            )}{" "}
            <Link href="/ideas" className="text-sky-300 underline">
              open bank →
            </Link>
          </section>
        )}

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-sky-500/50"
            >
              <p className="font-mono text-[11px] tracking-widest text-slate-500">
                {c.label}
              </p>
              <p className="mt-1 text-3xl font-bold text-white">
                {c.value.toLocaleString()}
              </p>
            </Link>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Newest ideas to triage</h2>
            <Link href="/ideas" className="font-mono text-xs text-sky-300 underline">
              OPEN BANK →
            </Link>
          </div>
          {fresh.length === 0 ? (
            <p className="text-sm text-slate-400">
              Bank is clear. Run the pipeline or{" "}
              <Link href="/content" className="text-sky-300 underline">
                research topics
              </Link>
              .
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {fresh.map((idea) => (
                <li
                  key={idea.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase">
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">
                      {idea.format}
                    </span>
                    <span className="text-slate-500">{idea.score}/10</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {idea.title}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => triage(idea.id, "approved")}
                      className="rounded-full bg-red-700 px-4 py-1.5 font-mono text-[11px] font-bold text-white hover:bg-red-800"
                    >
                      APPROVE
                    </button>
                    <button
                      onClick={() => triage(idea.id, "skipped")}
                      className="rounded-full border border-slate-700 px-4 py-1.5 font-mono text-[11px] text-slate-300 hover:bg-white/5"
                    >
                      SKIP
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
