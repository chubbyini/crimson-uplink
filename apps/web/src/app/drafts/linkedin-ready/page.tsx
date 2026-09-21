"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

interface DraftItem {
  id: string;
  title: string;
  format: string;
  body: string;
  linkedinBody?: string;
  status: string;
}

function LinkedInReadyContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [currentDraft, setCurrentDraft] = useState<DraftItem | null>(null);

  const [copied, setCopied] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedLinkedin, setEditedLinkedin] = useState<string>("");

  async function loadDrafts(u: User) {
    if (!db) return;
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", u.uid, "drafts"),
          orderBy("createdAt", "desc"),
          limit(30)
        )
      );
      const items: DraftItem[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Omit<DraftItem, "id">;
        if (data.status !== "published" && data.status !== "rejected") {
          items.push({ id: d.id, ...data });
        }
      }
      setDrafts(items);

      const targetId = selectedId || (items.length ? items[0].id : null);
      if (targetId) {
        const match = items.find((i) => i.id === targetId);
        if (match) {
          setCurrentDraft(match);
          setSelectedId(match.id);
          setEditedLinkedin(match.linkedinBody || match.body);

          // Auto-refine for LinkedIn if not refined yet
          if (!match.linkedinBody) {
            void refineDraft(u, match.id);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    void loadDrafts(user);
  }, [initialId, user, authLoading, router]);

  function handleSelectDraft(id: string) {
    setSelectedId(id);
    const match = drafts.find((i) => i.id === id);
    if (match) {
      setCurrentDraft(match);
      setEditedLinkedin(match.linkedinBody || match.body);
      if (!match.linkedinBody && user) {
        void refineDraft(user, match.id);
      }
    }
  }

  async function refineDraft(u: User, id: string) {
    setRefining(true);
    setError(null);
    try {
      const token = await u.getIdToken();
      const res = await fetch("/api/drafts/refine-linkedin", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ draftId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refine failed");

      setEditedLinkedin(data.linkedinBody);
      setCurrentDraft((prev) => (prev ? { ...prev, linkedinBody: data.linkedinBody } : null));
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, linkedinBody: data.linkedinBody } : d))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refine failed");
    } finally {
      setRefining(false);
    }
  }

  async function copyToClipboard() {
    if (!editedLinkedin) return;
    await navigator.clipboard.writeText(editedLinkedin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function saveEdits() {
    if (!user || !db || !currentDraft) return;
    await updateDoc(doc(db, "users", user.uid, "drafts", currentDraft.id), {
      linkedinBody: editedLinkedin,
    });
    setCurrentDraft((prev) => (prev ? { ...prev, linkedinBody: editedLinkedin } : null));
  }

  const charCount = editedLinkedin.length;
  const isOverLimit = charCount > 3000;

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">LinkedIn Ready</h1>
        <p className="mt-4 text-slate-400">Configure Firebase first.</p>
      </main>
    );
  }

  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">LinkedIn Ready</h1>
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">LinkedIn Ready</h1>
        <p className="mt-4 text-slate-400">
          Sign in with Google to view your LinkedIn Ready posts.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-500/20 px-3 py-1 font-mono text-xs font-semibold text-sky-400 uppercase">
              LinkedIn Ready
            </span>
            <span className="text-xs text-slate-500">3,000 Char Limit Enforced</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Copy-Paste LinkedIn Post
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Formatted with hooks, clean line breaks, bullet points, and hashtags. Ready to publish.
          </p>
        </div>

        <Link
          href="/drafts"
          className="self-start text-xs font-medium text-sky-400 underline hover:text-sky-300 sm:self-auto"
        >
          ← Back to Drafts
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* Select Draft Picker */}
      {drafts.length > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <label className="text-xs font-medium text-slate-400">
            Select Article Draft:
          </label>
          <select
            value={selectedId || ""}
            onChange={(e) => handleSelectDraft(e.target.value)}
            className="input w-auto text-xs"
          >
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({d.format})
              </option>
            ))}
          </select>
        </div>
      )}

      {currentDraft ? (
        <div className="mt-6 flex flex-col gap-6">
          {/* Main Post Card */}
          <div className="ui-panel p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <h2 className="text-lg font-semibold text-slate-100">
                {currentDraft.title}
              </h2>

              {/* Character Limit Badge */}
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-semibold ${
                  isOverLimit
                    ? "bg-red-500/20 text-red-500 border border-red-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                <span>{charCount.toLocaleString()} / 3,000 chars</span>
                <span>{isOverLimit ? "⚠️ Exceeds Limit" : "✓ Within Limit"}</span>
              </div>
            </div>

            {/* Editable LinkedIn Output Box */}
            <div className="mt-4">
              <textarea
                rows={16}
                value={editedLinkedin}
                onChange={(e) => setEditedLinkedin(e.target.value)}
                onBlur={saveEdits}
                placeholder="LinkedIn ready text will appear here..."
                className="input w-full p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap"
              />
            </div>

            {/* Action Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={copyToClipboard}
                  disabled={!editedLinkedin}
                  className="flex items-center gap-2 rounded-full bg-sky-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg transition-transform hover:bg-sky-500 active:scale-95 disabled:opacity-50"
                >
                  {copied ? "Copied to Clipboard! ✓" : "📋 Copy to Clipboard"}
                </button>

                <a
                  href="https://www.linkedin.com/feed/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full bg-slate-800 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  🚀 Open LinkedIn to Post ↗
                </a>
              </div>

              <button
                onClick={() => user && refineDraft(user, currentDraft.id)}
                disabled={refining}
                className="rounded-full border border-sky-500/30 px-4 py-2 text-xs font-medium text-sky-400 hover:bg-sky-500/10 disabled:opacity-50"
              >
                {refining ? "Refining with Groq…" : "✨ Re-Refine with Groq"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-12 text-center text-sm text-slate-500">
          No active drafts found. Approve an idea and create a draft first.
        </div>
      )}
    </main>
  );
}

export default function LinkedInReadyPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm">Loading LinkedIn Ready...</div>}>
      <LinkedInReadyContent />
    </Suspense>
  );
}
