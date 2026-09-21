"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type Platform = "linkedin" | "devto" | "x" | "medium";

interface PublishRow {
  id: string;
  title: string;
  platform: Platform;
  url?: string;
  draftId?: string;
  devtoId?: number;
  views?: number;
  reactions?: number;
  comments?: number;
  manualViews?: number;
  manualLikes?: number;
  publishedAt: string;
  syncedAt?: string;
}

const platforms: Platform[] = ["linkedin", "devto", "x", "medium"];

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<PublishRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "syncing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", platform: "linkedin" as Platform, url: "" });
  const [edits, setEdits] = useState<Record<string, { views: string; likes: string }>>({});

  async function load(u: User) {
    if (!db) return;
    setStatus("loading");
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", u.uid, "publishes"),
          orderBy("publishedAt", "desc"),
          limit(100)
        )
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublishRow, "id">) }));
      setRows(list);
      const e: Record<string, { views: string; likes: string }> = {};
      for (const r of list) {
        e[r.id] = {
          views: String(r.manualViews ?? ""),
          likes: String(r.manualLikes ?? ""),
        };
      }
      setEdits(e);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load publishes");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    void load(user);
  }, [user, authLoading, router]);

  async function logPublish(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !db || !form.title.trim()) return;
    await addDoc(collection(db, "users", user.uid, "publishes"), {
      title: form.title.trim(),
      platform: form.platform,
      url: form.url.trim() || null,
      publishedAt: new Date().toISOString(),
    });
    setForm({ title: "", platform: "linkedin", url: "" });
    await load(user);
  }

  async function saveManual(id: string) {
    if (!user || !db) return;
    const e = edits[id];
    const parseNum = (s: string): number | null => {
      if (s.trim() === "") return null;
      const n = Number(s);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };
    const views = parseNum(e.views);
    const likes = parseNum(e.likes);
    if ((e.views.trim() !== "" && views === null) || (e.likes.trim() !== "" && likes === null)) {
      setError("Views/likes must be numbers 0 or higher");
      return;
    }
    await updateDoc(doc(db, "users", user.uid, "publishes", id), {
      manualViews: views,
      manualLikes: likes,
    });
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              manualViews: views ?? undefined,
              manualLikes: likes ?? undefined,
            }
          : r
      )
    );
  }

  async function sync() {
    if (!user) return;
    setStatus("syncing");
    setError(null);
    setSyncInfo(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/stats/sync", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncInfo(`Checked ${data.checked} Dev.to posts, updated ${data.updated}.`);
      await load(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
      setStatus("error");
    } finally {
      setStatus((s) => (s === "syncing" ? "idle" : s));
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Configure Firebase first (see docs/FIREBASE_SETUP.md).
        </p>
      </main>
    );
  }
  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-4 text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Sign in with Google (top right) to see your stats.
        </p>
      </main>
    );
  }

  const totals = rows.reduce(
    (t, r) => ({
      views: t.views + (r.platform === "devto" ? (r.views ?? 0) : (r.manualViews ?? 0)),
      likes: t.likes + (r.platform === "devto" ? (r.reactions ?? 0) : (r.manualLikes ?? 0)),
    }),
    { views: 0, likes: 0 }
  );

  const inputCls =
    "mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <button
          onClick={sync}
          disabled={status === "syncing"}
          className="flex h-10 items-center rounded-full bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {status === "syncing" ? "Syncing…" : "Sync Dev.to stats"}
        </button>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Dev.to syncs automatically via API. LinkedIn / X / Medium have no
        personal analytics API — enter numbers by hand from each platform.
        Totals: <strong>{totals.views.toLocaleString()} views</strong>,{" "}
        <strong>{totals.likes.toLocaleString()} likes/reactions</strong>.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {syncInfo && <p className="mt-3 text-sm text-green-600">{syncInfo}</p>}

      <form onSubmit={logPublish} className="mt-6 rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <h2 className="text-base font-semibold">Log a publish</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="block text-sm font-medium">
            Title
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="What you published"
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium">
            Platform
            <select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Platform }))}
              className={inputCls}
            >
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium">
          URL (optional)
          <input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://…"
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          className="mt-3 flex h-10 items-center rounded-full bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800"
        >
          Log it
        </button>
      </form>

      <ul className="mt-6 flex flex-col gap-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono uppercase dark:bg-white/10">
                {r.platform}
              </span>
              <span className="text-zinc-500">{r.publishedAt.slice(0, 10)}</span>
            </div>
            {r.url ? (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block font-medium text-slate-800 hover:underline dark:text-slate-100"
              >
                {r.title}
              </a>
            ) : (
              <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">{r.title}</p>
            )}
            {r.platform === "devto" ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {r.views ?? 0} views · {r.reactions ?? 0} reactions ·{" "}
                {r.comments ?? 0} comments
                {r.syncedAt && (
                  <span className="text-xs text-zinc-500"> · synced {r.syncedAt.slice(0, 10)}</span>
                )}
              </p>
            ) : (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <input
                  inputMode="numeric"
                  placeholder="views"
                  value={edits[r.id]?.views ?? ""}
                  onChange={(e) =>
                    setEdits((m) => ({ ...m, [r.id]: { ...m[r.id], views: e.target.value } }))
                  }
                  className="w-24 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm text-black dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <input
                  inputMode="numeric"
                  placeholder="likes"
                  value={edits[r.id]?.likes ?? ""}
                  onChange={(e) =>
                    setEdits((m) => ({ ...m, [r.id]: { ...m[r.id], likes: e.target.value } }))
                  }
                  className="w-24 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm text-black dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  onClick={() => saveManual(r.id)}
                  className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Save
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {status === "idle" && !rows.length && (
        <p className="mt-6 text-sm text-zinc-500">
          Nothing logged yet — or publish from{" "}
          <Link href="/drafts" className="underline">
            drafts
          </Link>{" "}
          and log it here.
        </p>
      )}
    </main>
  );
}
