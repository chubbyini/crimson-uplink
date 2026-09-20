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

interface DraftRow {
  id: string;
  ideaId: string;
  title: string;
  format: string;
  body: string;
  model: string;
  status: "pending_review" | "approved" | "rejected" | "published";
  createdAt: string;
}

export default function DraftsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function load(u: User) {
    if (!db) return;
    setStatus("loading");
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", u.uid, "drafts"),
          orderBy("createdAt", "desc"),
          limit(30)
        )
      );
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DraftRow, "id">) })));
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
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

  async function setDraftStatus(id: string, s: DraftRow["status"]) {
    if (!user || !db) return;
    await updateDoc(doc(db, "users", user.uid, "drafts", id), { status: s });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: s } : r)));
  }

  async function copy(id: string, body: string) {
    await navigator.clipboard.writeText(body);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Drafts</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Configure Firebase first (see docs/FIREBASE_SETUP.md).
        </p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Drafts</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Sign in with Google (top right) to see your drafts.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Drafts</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Draft from an approved idea on the{" "}
        <Link href="/ideas" className="underline">
          idea bank
        </Link>{" "}
        (Approve → draft in a later step; API: POST /api/drafts with ideaId).
        Copy-paste to LinkedIn for now — API publish lands next.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-6 flex flex-col gap-4">
        {rows.map((d) => (
          <li
            key={d.id}
            className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono uppercase dark:bg-white/10">
                {d.format}
              </span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono dark:bg-white/10">
                {d.status}
              </span>
              <span className="font-mono text-zinc-500">{d.model}</span>
            </div>
            <p className="mt-2 text-lg font-semibold">{d.title}</p>
            <button
              onClick={() => setOpen((o) => (o === d.id ? null : d.id))}
              className="mt-1 text-xs text-zinc-500 underline"
            >
              {open === d.id ? "Hide" : "Preview"}
            </button>
            {open === d.id && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-black/5 p-3 text-sm whitespace-pre-wrap dark:bg-white/5">
                {d.body}
              </pre>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => copy(d.id, d.body)}
                className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
              >
                {copied === d.id ? "Copied ✓" : "Copy text"}
              </button>
              {d.status === "pending_review" && (
                <>
                  <button
                    onClick={() => setDraftStatus(d.id, "approved")}
                    className="rounded-full bg-red-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setDraftStatus(d.id, "rejected")}
                    className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {status === "idle" && !rows.length && (
        <p className="mt-6 text-sm text-zinc-500">
          No drafts yet. Approve an idea, then draft it via POST /api/drafts.
        </p>
      )}
    </main>
  );
}
