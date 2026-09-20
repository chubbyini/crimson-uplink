"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { emptySettings, type Settings } from "@/lib/settings";
import { getSettings, saveSettings } from "@/lib/settings-store";

const toLines = (arr: string[]) => arr.join("\n");
const fromLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<Settings>(emptySettings);
  const [lists, setLists] = useState({
    rssFeeds: "",
    youtubeChannelIds: "",
    blueskyHandles: "",
    mastodonHandles: "",
    npmPackages: "",
    devtoTags: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [ingest, setIngest] = useState<null | {
    fetched: number;
    unique: number;
    added: number;
    seenBefore: number;
  }>(null);
  const [ingesting, setIngesting] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setStatus("loading");
        try {
          const existing = await getSettings(u.uid);
          const s = existing ?? emptySettings;
          setForm(s);
          setLists({
            rssFeeds: toLines(s.rssFeeds),
            youtubeChannelIds: toLines(s.youtubeChannelIds),
            blueskyHandles: toLines(s.blueskyHandles),
            mastodonHandles: toLines(s.mastodonHandles),
            npmPackages: toLines(s.npmPackages),
            devtoTags: toLines(s.devtoTags),
          });
          setStatus("idle");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load settings");
          setStatus("error");
        }
      }
    });
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Firebase isn&apos;t configured yet. Follow{" "}
          <code className="font-mono text-sm">docs/FIREBASE_SETUP.md</code> to
          add your web config, then return here.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Sign in with Google (top right) to manage your keys and sources.
        </p>
      </main>
    );
  }

  const set = (k: keyof Settings, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await saveSettings(user!.uid, {
        ...form,
        rssFeeds: fromLines(lists.rssFeeds),
        youtubeChannelIds: fromLines(lists.youtubeChannelIds),
        blueskyHandles: fromLines(lists.blueskyHandles),
        mastodonHandles: fromLines(lists.mastodonHandles),
        npmPackages: fromLines(lists.npmPackages),
        devtoTags: fromLines(lists.devtoTags),
      });
      setStatus("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setStatus("error");
    }
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Bring your own keys — stored under{" "}
        <code className="font-mono">users/{user.uid}/settings</code>, visible
        only to you. MVP stores them as-is (see PRODUCT.md tradeoffs).
      </p>
      <form onSubmit={onSave} className="mt-8 flex flex-col gap-5">
        <label className="block text-sm font-medium">
          Gemini API key (ideas)
          <input
            type="password"
            autoComplete="off"
            value={form.geminiKey}
            onChange={(e) => set("geminiKey", e.target.value)}
            placeholder="AIza…"
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          Groq API key (voice/drafter)
          <input
            type="password"
            autoComplete="off"
            value={form.groqKey}
            onChange={(e) => set("groqKey", e.target.value)}
            placeholder="gsk_…"
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          Dev.to API key (publish + stats)
          <input
            type="password"
            autoComplete="off"
            value={form.devtoKey}
            onChange={(e) => set("devtoKey", e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          LinkedIn token (publish, manual-paste first)
          <input
            type="password"
            autoComplete="off"
            value={form.linkedinToken}
            onChange={(e) => set("linkedinToken", e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          GitHub token (optional — raises trending-search rate limit)
          <input
            type="password"
            autoComplete="off"
            value={form.githubToken}
            onChange={(e) => set("githubToken", e.target.value)}
            placeholder="github_pat_…"
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          Telegram chat ID (shared bot → your DMs)
          <input
            inputMode="numeric"
            autoComplete="off"
            value={form.telegramChatId}
            onChange={(e) => set("telegramChatId", e.target.value)}
            placeholder="123456789"
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          RSS / newsletter feeds (one URL per line)
          <textarea
            rows={4}
            value={lists.rssFeeds}
            onChange={(e) => setLists((l) => ({ ...l, rssFeeds: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          YouTube channel IDs (one per line)
          <textarea
            rows={2}
            value={lists.youtubeChannelIds}
            onChange={(e) => setLists((l) => ({ ...l, youtubeChannelIds: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          Bluesky handles (one per line)
          <textarea
            rows={2}
            value={lists.blueskyHandles}
            onChange={(e) => setLists((l) => ({ ...l, blueskyHandles: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          Mastodon handles (one per line, @user@instance)
          <textarea
            rows={2}
            value={lists.mastodonHandles}
            onChange={(e) => setLists((l) => ({ ...l, mastodonHandles: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          npm packages to watch (one per line)
          <textarea
            rows={2}
            value={lists.npmPackages}
            onChange={(e) => setLists((l) => ({ ...l, npmPackages: e.target.value }))}
            placeholder={"react\ntypescript"}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          Dev.to tags to watch (one per line)
          <textarea
            rows={2}
            value={lists.devtoTags}
            onChange={(e) => setLists((l) => ({ ...l, devtoTags: e.target.value }))}
            placeholder={"javascript\nai"}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.ingestEnabled}
            onChange={(e) => set("ingestEnabled", e.target.checked)}
          />
          Morning ingest enabled
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "saving" || status === "loading"}
            className="flex h-11 items-center rounded-full bg-red-700 px-6 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save settings"}
          </button>
          {status === "saved" && (
            <span className="text-sm text-green-600">Saved.</span>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
      <section className="mt-10 rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <h2 className="text-base font-semibold">Ingest now</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pulls HN front page + your RSS feeds + YouTube channels into{" "}
          <code className="font-mono">users/{user.uid}/items</code>, deduped by
          URL hash. Needs server env{" "}
          <code className="font-mono">FIREBASE_SERVICE_ACCOUNT_JSON</code>.
        </p>
        <button
          type="button"
          disabled={ingesting}
          onClick={async () => {
            setIngesting(true);
            setIngest(null);
            setError(null);
            try {
              const token = await user.getIdToken();
              const res = await fetch("/api/ingest", {
                method: "POST",
                headers: { authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "Ingest failed");
              setIngest(data);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Ingest failed");
            } finally {
              setIngesting(false);
            }
          }}
          className="mt-3 flex h-10 items-center rounded-full border border-black/10 px-5 text-sm font-medium text-slate-700 hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
        >
          {ingesting ? "Ingesting…" : "Run ingest now"}
        </button>
        {ingest && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Fetched {ingest.fetched} · unique {ingest.unique} · added{" "}
            {ingest.added} · seen before {ingest.seenBefore}.
          </p>
        )}
      </section>
    </main>
  );
}
