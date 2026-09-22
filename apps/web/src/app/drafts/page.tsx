"use client";

import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
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
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { markdownToPlain } from "@/lib/plaintext";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { PageSkeleton } from "@/components/Skeletons";

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
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const [publishing, setPublishing] = useState<string | null>(null);
  const [pubUrls, setPubUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [aiPrompts, setAiPrompts] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [refiningLinkedin, setRefiningLinkedin] = useState<Record<string, boolean>>({});

  async function openRefineLinkedin(id: string) {
    if (!user) return;
    setRefiningLinkedin((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/drafts/refine-linkedin", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ draftId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "LinkedIn refine failed");

      // Open new tab to LinkedIn Ready page
      window.open(`/drafts/linkedin-ready?id=${id}`, "_blank");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LinkedIn refine failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setRefiningLinkedin((prev) => ({ ...prev, [id]: false }));
    }
  }

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
      // Read-only: never delete inside a read. Published/rejected are hidden;
      // delete explicitly via the Delete button (server route).
      const activeDocs: DraftRow[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Omit<DraftRow, "id">;
        if (data.status === "published" || data.status === "rejected") continue;
        activeDocs.push({ id: d.id, ...data });
      }
      setRows(activeDocs);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    // Auth-gated initial fetch: runs once per sign-in, not per render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(user);
  }, [user, authLoading, router]);

  async function deleteDraft(id: string, silent = false) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/drafts/delete", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ draftId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete draft");

      setRows((rs) => rs.filter((r) => r.id !== id));
      if (editing === id) setEditing(null);
      if (!silent) toast.success("Draft deleted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete draft";
      setError(msg);
      toast.error(msg);
    }
  }

  async function setDraftStatus(id: string, s: DraftRow["status"]) {
    if (!user) return;
    if (s === "rejected") {
      await deleteDraft(id);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/drafts/status", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ draftId: id, status: s }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update status");

      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: s } : r)));
      toast.success(s === "approved" ? "Draft approved ✓" : "Draft status updated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update status";
      setError(msg);
      toast.error(msg);
    }
  }

  async function copy(id: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      // Clipboard API needs HTTPS/focus — fallback to textarea + execCommand.
      try {
        const ta = document.createElement("textarea");
        ta.value = body;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        setError("Copy failed — select the text manually");
        toast.error("Copy failed — select the text manually");
        return;
      }
    }
    setCopied(id);
    toast.success("Copied to clipboard ✓");
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  }

  async function copyPlain(id: string, body: string) {
    await copy(`${id}-plain`, markdownToPlain(body));
  }

  async function saveEdit(id: string) {
    if (!user || !db) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "drafts", id), {
        body: editBody,
        editedAt: new Date().toISOString(),
      });
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, body: editBody } : r)));
      setEditing(null);
      toast.success("Edit saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save edit";
      setError(msg);
      toast.error(msg);
    }
  }

  async function aiRefineDraft(id: string, currentText: string) {
    if (!user) return;
    const prompt = aiPrompts[id]?.trim();
    if (!prompt) return;

    setAiLoading((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/drafts/edit", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draftId: id,
          currentBody: currentText,
          prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI edit failed");

      setEditBody(data.text);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, body: data.text } : r)));
      setAiPrompts((prev) => ({ ...prev, [id]: "" }));
      toast.success("Draft refined with Groq ✓");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI edit failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setAiLoading((prev) => ({ ...prev, [id]: false }));
    }
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
      toast.success(data.deduped ? "Already published — opened existing post" : "Published ✓");

      // If content in draft has been pushed, delete it
      await deleteDraft(id, true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      setError(msg);
      toast.error(msg);
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
        <h1 className="ui-title">Drafts</h1>
        <p className="mt-4 text-slate-400">
          Configure Firebase first (see docs/FIREBASE_SETUP.md).
        </p>
      </main>
    );
  }
  if (authLoading) return <PageSkeleton title="Drafts" />;
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="ui-title">Drafts</h1>
        <p className="mt-4 text-slate-400">
          Sign in with Google (top right) to see your drafts.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="ui-title">Drafts</h1>
      <p className="mt-2 text-sm text-slate-400">
        Review article-level drafts generated by Groq. When pushed or rejected, drafts are automatically cleaned up.
      </p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <ul className="mt-6 flex flex-col gap-4">
        {rows.map((d) => (
          <li
            key={d.id}
            className="ui-panel p-5"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="meta-pill uppercase">
                {d.format}
              </span>
              <span className="meta-pill">
                {d.status}
              </span>
              <span className="font-mono text-slate-500">{d.model}</span>
            </div>
            <p className="mt-2 text-lg font-semibold">{d.title}</p>
            <button
              onClick={() => setOpen((o) => (o === d.id ? null : d.id))}
              className="mt-1 text-xs text-slate-500 underline"
            >
              {open === d.id ? "Hide Preview" : "Preview Article"}
            </button>
            {open === d.id && editing !== d.id && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-black/40 p-3 text-sm whitespace-pre-wrap text-slate-200">
                {d.body}
              </pre>
            )}
            {editing === d.id && (
              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-red-500/20 bg-black/30 p-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Article Text Editor
                  </label>
                  <textarea
                    rows={14}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="input mt-1 p-3"
                  />
                </div>

                {/* Groq AI Modification Box */}
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <span className="text-xs font-semibold text-red-400">
                    ✨ Edit with Groq AI
                  </span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Add a section with practical code examples, or change tone to beginner-friendly..."
                      value={aiPrompts[d.id] ?? ""}
                      onChange={(e) =>
                        setAiPrompts((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void aiRefineDraft(d.id, editBody);
                        }
                      }}
                      className="input flex-1"
                    />
                    <button
                      onClick={() => aiRefineDraft(d.id, editBody)}
                      disabled={aiLoading[d.id] || !aiPrompts[d.id]?.trim()}
                      className="btn-primary-sm"
                    >
                      {aiLoading[d.id] ? "Refining…" : "Apply AI Edit"}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(d.id)}
                    className="btn-primary"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => openRefineLinkedin(d.id)}
                disabled={refiningLinkedin[d.id]}
                className="rounded-full border border-sky-500/50 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 disabled:opacity-50"
              >
                {refiningLinkedin[d.id] ? "Refining for LinkedIn…" : "Refine for LinkedIn 🚀"}
              </button>
              <button
                onClick={() => copy(d.id, d.body)}
                className="btn-ghost"
              >
                {copied === d.id ? "Copied ✓" : "Copy markdown"}
              </button>
              <button
                onClick={() => copyPlain(d.id, d.body)}
                className="btn-ghost"
                title="Plain wording without markdown — easy paste into LinkedIn/docs"
              >
                {copied === `${d.id}-plain` ? "Copied ✓" : "Copy plain text"}
              </button>
              {(d.status === "pending_review" || d.status === "approved") && editing !== d.id && (
                <button
                  onClick={() => {
                    setEditBody(d.body);
                    setEditing(d.id);
                    setOpen(d.id);
                  }}
                  className="btn-ghost"
                >
                  Edit / AI Refine
                </button>
              )}
              {d.status === "pending_review" && (
                <>
                  <button
                    onClick={() => setDraftStatus(d.id, "approved")}
                    className="btn-primary"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setDraftStatus(d.id, "rejected")}
                    className="btn-ghost"
                  >
                    Reject & Delete
                  </button>
                </>
              )}
              {d.status === "approved" && (
                <>
                  <button
                    onClick={() => publishDevto(d.id)}
                    disabled={publishing === d.id}
                    className="btn-primary"
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
              <button
                onClick={() => deleteDraft(d.id)}
                className="rounded-full border border-red-500/30 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
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
        <p className="mt-6 text-sm text-slate-500">
          No active drafts. Approve an idea from the idea bank to create new article drafts.
        </p>
      )}
    </main>
  );
}
