"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      if (!u) router.replace("/");
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

  const [publishing, setPublishing] = useState<string | null>(null);
  const [pubUrls, setPubUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  async function saveEdit(id: string) {
    if (!user || !db) return;
    await updateDoc(doc(db, "users", user.uid, "drafts", id), {
      body: editBody,
      editedAt: new Date().toISOString(),
    });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, body: editBody } : r)));
    setEditing(null);
  }

  async function publishTo(url: string, id: string, body?: object) {
    if (!user) return;
    setPublishing(id);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ draftId: id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setPubUrls((m) => ({ ...m, [id]: data.url }));
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: "published" } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(null);
    }
  }

  async function publishDevto(id: string) {
    await publishTo("/api/publish/devto", id);
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
            {open === d.id && editing !== d.id && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-black/5 p-3 text-sm whitespace-pre-wrap text-slate-800 dark:bg-white/5 dark:text-slate-100">
                {d.body}
              </pre>
            )}
            {editing === d.id && (
              <div className="mt-2">
                <textarea
                  rows={12}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm text-black dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => saveEdit(d.id)}
                    className="rounded-full bg-red-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => copy(d.id, d.body)}
                className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
              >
                {copied === d.id ? "Copied ✓" : "Copy text"}
              </button>
              {(d.status === "pending_review" || d.status === "approved") && editing !== d.id && (
                <button
                  onClick={() => {
                    setEditBody(d.body);
                    setEditing(d.id);
                    setOpen(d.id);
                  }}
                  className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Edit
                </button>
              )}
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
              {d.status === "approved" && (
                <>
                  <button
                    onClick={() => publishDevto(d.id)}
                    disabled={publishing === d.id}
                    className="rounded-full bg-red-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    {publishing === d.id ? "Publishing…" : "Publish to Dev.to"}
                  </button>
                  {d.format === "linkedin" && (
                    <button
                      onClick={() => publishTo("/api/publish/linkedin", d.id)}
                      disabled={publishing === d.id}
                      className="rounded-full border border-sky-500/50 px-4 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
                    >
                      {publishing === d.id ? "Publishing…" : "Publish to LinkedIn"}
                    </button>
                  )}
                </>
              )}
              {pubUrls[d.id] && (
                <a
                  href={pubUrls[d.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-center text-xs text-sky-400 underline"
                >
                  View live →
                </a>
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
