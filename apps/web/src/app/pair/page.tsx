"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured, db } from "@/lib/firebase";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { PageSkeleton } from "@/components/Skeletons";
import MechCycleTabs from "@/components/pair/MechCycleTabs";
import SessionDock from "@/components/pair/SessionDock";

interface PairTurn {
  role: "user" | "assistant";
  text: string;
  at: string;
}

interface PairArticle {
  id: string;
  title: string;
  format: string;
  workingBody: string;
  excerpts: Array<{ url: string; excerpt: string; via: string }>;
  status: string;
  ideaId?: string;
  shippedDraftId?: string;
}

interface PairSession {
  id: string;
  title: string;
  mode: "series" | "batch";
  phase: string;
  articles: PairArticle[];
  activeArticleId: string;
  history: PairTurn[];
  critiqueDepth: "deep" | "quick";
  status: "open" | "ended";
  updatedAt: string;
}

interface SessionSummary {
  id: string;
  title: string;
  mode: string;
  phase: string;
  status: string;
  updatedAt: string;
  articleCount: number;
}

type SeedKind = "idea" | "draft" | "blank" | "excerpts" | "paragraph";

const PHASE_TIPS: Record<string, string> = {
  plan: "Converge on angle + outline — no drafting yet, spar with your pair",
  draft: "Write now — ask for sections or /rewrite the working copy",
  critique: "Evaluate only — feedback without rewrites until you say so",
};

const QUICK_CMDS = ["/rewrite", "/critique", "/critique deep", "/ship", "/end"];

export default function PairPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [session, setSession] = useState<PairSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [composer, setComposer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showLauncher, setShowLauncher] = useState(false);
  const [seedKind, setSeedKind] = useState<SeedKind>("blank");
  const [seedMode, setSeedMode] = useState<"series" | "batch">("series");
  const [seedText, setSeedText] = useState("");
  const [seedTitle, setSeedTitle] = useState("");
  const [queue, setQueue] = useState<Array<{ label: string; entry: Record<string, unknown> }>>([]);
  const [drawer, setDrawer] = useState<null | "idea" | "draft">(null);
  const [drawerItems, setDrawerItems] = useState<Array<{ id: string; title: string; sub: string }>>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [pickCache, setPickCache] = useState<{
    ideas: Array<{ id: string; title: string; sub: string }>;
    drafts: Array<{ id: string; title: string; sub: string }>;
  } | null>(null);
  const [newArticleTitle, setNewArticleTitle] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const authed = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!user) throw new Error("Not signed in");
      const token = await user.getIdToken();
      const res = await fetch(path, {
        ...init,
        headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}`, "content-type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      return data;
    },
    [user]
  );

  const loadSessions = useCallback(async () => {
    try {
      const data = await authed("/api/pair?limit=20");
      setSessions(data.sessions ?? []);
      setNextCursor(data.nextCursor ?? null);
      setHasMoreSessions(Boolean(data.nextCursor));
    } catch {
      // List is best-effort; an open session still works.
    }
  }, [authed]);

  const loadMoreSessions = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await authed(`/api/pair?limit=20&cursor=${encodeURIComponent(nextCursor)}`);
      setSessions((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...(data.sessions ?? []).filter((s: SessionSummary) => !seen.has(s.id))];
      });
      setNextCursor(data.nextCursor ?? null);
      setHasMoreSessions(Boolean(data.nextCursor));
    } catch {
      // Infinite scroll is best-effort.
    } finally {
      setLoadingMore(false);
    }
  }, [authed, nextCursor, loadingMore]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      await loadSessions();
      // Deep-link seeds: /pair?ideaId=… or /pair?draftId=…
      try {
        const q = new URLSearchParams(window.location.search);
        const ideaId = q.get("ideaId");
        const draftId = q.get("draftId");
        if (ideaId) {
          setSeedKind("idea");
          setSeedText(ideaId);
          setShowLauncher(true);
        } else if (draftId) {
          setSeedKind("draft");
          setSeedText(draftId);
          setShowLauncher(true);
        }
      } catch {
        // Non-browser or malformed query — launcher stays manual.
      }
      setLoading(false);
    })();
  }, [user, authLoading, router, loadSessions]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.history.length, sending]);

  async function openSession(id: string) {
    setError(null);
    try {
      const data = await authed(`/api/pair?id=${encodeURIComponent(id)}`);
      setSession(data as PairSession);
      setShowLauncher(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to open session";
      setError(msg);
      toast.error(msg);
    }
  }

  function buildEntry() {
    const v = seedText.trim();
    switch (seedKind) {
      case "idea":
        if (!v) throw new Error("Paste an idea ID (from the Ideas page URL)");
        return { kind: "idea" as const, ideaId: v };
      case "draft":
        if (!v) throw new Error("Paste a draft ID (from the Drafts page)");
        return { kind: "draft" as const, draftId: v };
      case "blank":
        if (!v) throw new Error("Enter a topic");
        return { kind: "blank" as const, topic: v };
      case "excerpts":
        if (!v) throw new Error("Paste source material");
        return { kind: "excerpts" as const, title: seedTitle.trim() || "(untitled)", material: v };
      case "paragraph":
        if (!v) throw new Error("Paste or write your paragraph");
        return { kind: "paragraph" as const, title: seedTitle.trim() || "(untitled)", paragraph: v };
    }
  }

  async function startSession() {
    setError(null);
    let entries: Record<string, unknown>[];
    try {
      const current = seedText.trim() || seedTitle.trim() ? buildEntry() : null;
      entries = [...queue.map((q) => q.entry), ...(current ? [current as unknown as Record<string, unknown>] : [])];
      if (!entries.length) throw new Error("Add at least one seed — fill the form or queue several");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid seed";
      setError(msg);
      toast.error(msg);
      return;
    }
    setStarting(true);
    try {
      const data = await authed("/api/pair/start", {
        method: "POST",
        body: JSON.stringify({ entries, mode: entries.length > 1 ? "batch" : seedMode }),
      });
      setSession(data as PairSession);
      setShowLauncher(false);
      setSeedText("");
      setSeedTitle("");
      setQueue([]);
      await loadSessions();
      toast.success(
        entries.length > 1 ? `Batch session open with ${entries.length} articles ✓` : "Pair session open ✓"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start session";
      setError(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  }

  function queueCurrentSeed() {
    try {
      const entry = buildEntry();
      const label =
        seedKind === "idea" ? `Idea ${seedText.trim().slice(0, 12)}…`
        : seedKind === "draft" ? `Draft ${seedText.trim().slice(0, 12)}…`
        : seedKind === "blank" ? `Blank: ${seedText.trim().slice(0, 40)}`
        : `${seedKind}: ${seedTitle.trim().slice(0, 40) || "(untitled)"}`;
      setQueue((q) => [...q, { label, entry: entry as unknown as Record<string, unknown> }]);
      setSeedText("");
      setSeedTitle("");
      toast.success("Seed queued — add another or open the session");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid seed";
      setError(msg);
      toast.error(msg);
    }
  }

  async function loadPickLists() {
    if (!user || !db) return null;
    const [ideasSnap, draftsSnap] = await Promise.all([
      getDocs(query(collection(db, "users", user.uid, "ideas"), orderBy("createdAt", "desc"), limit(30))),
      getDocs(query(collection(db, "users", user.uid, "drafts"), orderBy("createdAt", "desc"), limit(30))),
    ]);
    const lists = {
      ideas: ideasSnap.docs.map((d) => {
        const v = d.data() as { title?: string; angle?: string; status?: string };
        return { id: d.id, title: v.title ?? "(untitled)", sub: `${v.status ?? ""} · ${(v.angle ?? "").slice(0, 80)}` };
      }),
      drafts: draftsSnap.docs.map((d) => {
        const v = d.data() as { title?: string; status?: string; format?: string };
        return { id: d.id, title: v.title ?? "(untitled)", sub: `${v.status ?? ""} · ${v.format ?? ""}` };
      }),
    };
    setPickCache(lists);
    return lists;
  }

  // Preload picker lists while the launcher is visible so the drawer opens instantly.
  useEffect(() => {
    if (!showLauncher || pickCache) return;
    // Prefetch-on-view: not render-derived state, safe to kick off here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPickLists().catch(() => {});
  }, [showLauncher, user]);

  async function openDrawer(kind: "idea" | "draft") {
    setDrawer(kind);
    const cached = pickCache?.[kind === "idea" ? "ideas" : "drafts"];
    if (cached) {
      setDrawerItems(cached);
      return;
    }
    setDrawerItems([]);
    if (!user || !db) return;
    setDrawerLoading(true);
    try {
      const lists = await loadPickLists();
      setDrawerItems(lists?.[kind === "idea" ? "ideas" : "drafts"] ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load list");
    } finally {
      setDrawerLoading(false);
    }
  }

  async function refreshDrawer() {
    if (!drawer) return;
    setDrawerLoading(true);
    try {
      const lists = await loadPickLists();
      setDrawerItems(lists?.[drawer === "idea" ? "ideas" : "drafts"] ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reload list");
    } finally {
      setDrawerLoading(false);
    }
  }

  async function sendMessage(raw?: string) {
    const text = (raw ?? composer).trim();
    if (!text || !session || sending) return;
    setError(null);
    // Optimistic user bubble + pending partner indicator.
    const optimistic: PairSession = {
      ...session,
      history: [...session.history, { role: "user", text, at: new Date().toISOString() }],
    };
    setSession(optimistic);
    setComposer("");
    setSending(true);
    try {
      const data = await authed("/api/pair/message", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.id, text }),
      });
      if (data.ended) {
        await openSession(session.id);
        toast.success("Session ended");
        return;
      }
      if (data.shipped) {
        await openSession(session.id);
        toast.success(`Shipped ${data.shipped.length} draft${data.shipped.length === 1 ? "" : "s"} ✓`);
        return;
      }
      setSession(data.session as PairSession);
      if (data.session) await loadSessions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      setError(msg);
      toast.error(msg);
      // Roll back the optimistic bubble on failure.
      setSession(session);
      setComposer(text);
    } finally {
      setSending(false);
    }
  }

  async function ship(indices?: number[]) {
    if (!session) return;
    setError(null);
    try {
      const data = await authed("/api/pair/ship", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.id, indices }),
      });
      await openSession(session.id);
      await loadSessions();
      toast.success(`Shipped ${data.shipped.length} draft${data.shipped.length === 1 ? "" : "s"} ✓`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ship failed";
      setError(msg);
      toast.error(msg);
    }
  }

  async function endSession() {
    if (!session) return;
    try {
      await authed("/api/pair/end", { method: "POST", body: JSON.stringify({ sessionId: session.id }) });
      await openSession(session.id);
      await loadSessions();
      toast.success("Session ended — history kept");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "End failed";
      setError(msg);
      toast.error(msg);
    }
  }

  function deleteSession(id: string, title: string) {
    setPendingDelete({ id, title });
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    const { id } = pendingDelete;
    setDeleting(true);
    setError(null);
    try {
      await authed("/api/pair", { method: "DELETE", body: JSON.stringify({ sessionId: id }) });
      if (session?.id === id) {
        setSession(null);
        setShowLauncher(true);
      }
      setPendingDelete(null);
      await loadSessions();
      toast.success("Session deleted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function setDepth(depth: "deep" | "quick") {
    if (!session || session.critiqueDepth === depth) return;
    try {
      const data = await authed("/api/pair/message", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.id, text: `/depth ${depth}` }),
      });
      setSession(data.session as PairSession);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Depth switch failed");
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="ui-title">Pair Writer</h1>
        <p className="mt-4 text-slate-400">Firebase isn&apos;t configured yet.</p>
      </main>
    );
  }
  if (authLoading) return <PageSkeleton title="Pair Writer" rows={3} />;
  if (loading) return <PageSkeleton title="Pair Writer" rows={3} />;
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="ui-title">Pair Writer</h1>
        <p className="mt-4 text-slate-400">Sign in with Google (top right) to co-write with Groq.</p>
      </main>
    );
  }

  const active = session?.articles.find((a) => a.id === session.activeArticleId);
  const activeIdx = session ? session.articles.findIndex((a) => a.id === session.activeArticleId) : -1;

  return (
    <main className="pair-stage mx-auto w-full max-w-6xl px-6 pt-12 pb-16">
      <div className="pair-bg" aria-hidden />
      <div className="pair-content">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="ui-title">Pair Writer</h1>
          <p className="ui-sub">Build articles with Groq like a pair — plan, draft, critique, ship.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setSession(null); setShowLauncher(true); }} className="btn-ghost">
            + New session
          </button>
          <Link href="/drafts" className="btn-ghost">Drafts</Link>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 min-w-0">
        <section className="min-w-0">
          {(!session || showLauncher) && (
            <div className="ui-panel p-5">
              <h2 className="text-base font-semibold">Launch a session</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["idea", "draft", "blank", "excerpts", "paragraph"] as SeedKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSeedKind(k)}
                    className={seedKind === k ? "chip-active" : "chip"}
                  >
                    {k === "idea" ? "From idea" : k === "draft" ? "From draft" : k === "blank" ? "Blank page" : k === "excerpts" ? "From excerpts" : "My paragraph"}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="self-center text-slate-400">Mode:</span>
                {(["series", "batch"] as const).map((m) => (
                  <button key={m} onClick={() => setSeedMode(m)} className={seedMode === m ? "chip-active" : "chip"}>
                    {m}
                  </button>
                ))}
              </div>
              {(seedKind === "excerpts" || seedKind === "paragraph") && (
                <input
                  value={seedTitle}
                  onChange={(e) => setSeedTitle(e.target.value)}
                  placeholder="Working title"
                  className="input mt-3"
                />
              )}
              {(seedKind === "idea" || seedKind === "draft") && (
                <button onClick={() => openDrawer(seedKind)} className="btn-ghost mt-3">
                  Browse {seedKind === "idea" ? "ideas" : "drafts"}…
                </button>
              )}
              <textarea
                rows={seedKind === "blank" || seedKind === "idea" || seedKind === "draft" ? 2 : 6}
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                placeholder={
                  seedKind === "idea" ? "Idea ID (or Browse…)"
                  : seedKind === "draft" ? "Draft ID (or Browse…)"
                  : seedKind === "blank" ? "What should we write about?"
                  : seedKind === "excerpts" ? "Paste source material…"
                  : "Paste or write your paragraph…"
                }
                className="input mt-3"
              />
              {queue.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {queue.map((q, i) => (
                    <span key={i} className="meta-pill">
                      {i + 1}. {q.label}{" "}
                      <button
                        onClick={() => setQueue((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Remove seed ${i + 1}`}
                        className="ml-1 text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={queueCurrentSeed} className="btn-ghost h-10">
                  + Queue this seed{queue.length > 0 ? ` (${queue.length + 1})` : ""}
                </button>
                <button onClick={startSession} disabled={starting} className="btn-primary h-10 px-5">
                  {starting ? "Opening…" : queue.length > 0 ? `Open batch session (${queue.length + (seedText.trim() || seedTitle.trim() ? 1 : 0)})` : "Open pair session"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Queue several seeds (blank twice, excerpts twice…) to open one batch session with many articles.
              </p>
            </div>
          )}

          {/* Picker drawer is rendered at the end of <main> (outside .pair-content)
              so its z-50 overlay stays above page content. */}

          {session && !showLauncher && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="meta-pill">{session.mode}</span>
                <div className="flex gap-1" role="group" aria-label="Phase">
                  {(["plan", "draft", "critique"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(`/phase ${p}`)}
                      disabled={sending}
                      title={PHASE_TIPS[p]}
                      className={session.phase === p ? "chip-active" : "chip"}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <span className="meta-pill">depth: {session.critiqueDepth}</span>
                <span className="meta-pill">{session.status}</span>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => setDepth(session.critiqueDepth === "deep" ? "quick" : "deep")}
                    className="btn-ghost"
                    title="Toggle critique depth"
                  >
                    {session.critiqueDepth === "deep" ? "Go quick" : "Go deep"}
                  </button>
                  <button onClick={() => ship()} className="btn-ghost">Ship all</button>
                  <button onClick={endSession} className="btn-ghost">End</button>
                  <button
                    onClick={() => session && deleteSession(session.id, session.title)}
                    className="btn-ghost hover:border-red-700 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <MechCycleTabs
                  articles={session.articles.map((a) => ({
                    id: a.id,
                    title: a.title,
                    status: a.status,
                    words: a.workingBody.split(/\s+/).filter(Boolean).length,
                  }))}
                  activeId={session.activeArticleId}
                  onSelect={(id) => sendMessage(`/switch ${session.articles.findIndex((a) => a.id === id) + 1}`)}
                  onNew={() => setNewArticleTitle("")}
                />
                {newArticleTitle !== null && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newArticleTitle}
                      onChange={(e) => setNewArticleTitle(e.target.value)}
                      placeholder="New article title…"
                      className="input"
                    />
                    <button
                      onClick={() => { sendMessage(`/new ${newArticleTitle.trim()}`); setNewArticleTitle(null); }}
                      className="btn-primary-sm"
                    >
                      Forge
                    </button>
                    <button onClick={() => setNewArticleTitle(null)} className="btn-ghost">Cancel</button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {/* Thread */}
                <div className="ui-panel flex min-h-[24rem] min-w-0 flex-col p-4">
                  <div ref={threadRef} className="flex max-h-[32rem] flex-1 flex-col gap-3 overflow-y-auto pr-1">
                    {session.history.map((t, i) => (
                      <div
                        key={i}
                        className={`max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere] ${
                          t.role === "user"
                            ? "self-end bg-red-700/80 text-white"
                            : "self-start border border-slate-800 bg-white/5 text-slate-200"
                        }`}
                      >
                        {t.text}
                      </div>
                    ))}
                    {sending && (
                      <div className="self-start rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-sm text-slate-400">
                        Pair is thinking…
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {QUICK_CMDS.map((c) => (
                      <button key={c} onClick={() => sendMessage(c)} disabled={sending} className="chip">
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder={session.status === "open" ? "Talk to your pair… (/rewrite /critique /ship)" : "Session closed"}
                      disabled={sending || session.status !== "open"}
                      className="input"
                    />
                    <button onClick={() => sendMessage()} disabled={sending || !composer.trim()} className="btn-primary">
                      {sending ? "…" : "Send"}
                    </button>
                  </div>
                </div>

                {/* Working copy */}
                <div className="ui-panel flex min-h-[24rem] min-w-0 flex-col p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-200">
                      {active ? `#${activeIdx + 1} ${active.title}` : "No article"}
                    </h3>
                    <span className="meta-pill ml-auto">{active?.status}</span>
                  </div>
                  <pre className="mt-2 max-h-[32rem] flex-1 overflow-y-auto rounded-lg bg-black/30 p-3 font-mono text-xs whitespace-pre-wrap text-slate-300 [overflow-wrap:anywhere]">
                    {active?.workingBody || "No working copy yet — plan first, then /rewrite."}
                  </pre>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => ship([activeIdx])} disabled={activeIdx < 0} className="btn-primary-sm">
                      Ship this article
                    </button>
                    <button onClick={() => sendMessage("/rewrite")} disabled={sending} className="btn-ghost">
                      /rewrite
                    </button>
                    <button onClick={() => sendMessage("/critique")} disabled={sending} className="btn-ghost">
                      /critique
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <SessionDock
        sessions={sessions}
        hasMore={hasMoreSessions}
        loadingMore={loadingMore}
        activeId={session?.id ?? null}
        onOpen={openSession}
        onNew={() => { setSession(null); setShowLauncher(true); }}
        onLoadMore={loadMoreSessions}
        onDelete={deleteSession}
      />
      </div>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Delete session"
            aria-describedby="delete-session-desc"
            className="ui-panel w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape" && !deleting) setPendingDelete(null); }}
          >
            <h2 className="text-base font-semibold text-slate-100">Delete session?</h2>
            <p id="delete-session-desc" className="mt-2 text-sm text-slate-400">
              Delete <span className="text-slate-200">“{pendingDelete.title}”</span>?
              Shipped drafts are kept.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="btn-primary"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setDrawer(null)}>
          <div
            role="dialog"
            aria-label={drawer === "idea" ? "Pick an idea" : "Pick a draft"}
            className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">
                Pick {drawer === "idea" ? "an idea" : "a draft"}
              </h2>
              <button onClick={refreshDrawer} className="btn-ghost ml-auto" disabled={drawerLoading}>
                {drawerLoading ? "…" : "Reload"}
              </button>
              <button onClick={() => setDrawer(null)} className="btn-ghost">Close</button>
            </div>
            {drawerLoading && <p className="mt-4 text-sm text-slate-400">Loading…</p>}
            <div className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
              {drawerItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setSeedText(item.id); setDrawer(null); }}
                  className="rounded-xl border border-slate-800 p-3 text-left hover:bg-white/5"
                >
                  <span className="block truncate text-sm text-slate-200">{item.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">{item.sub}</span>
                </button>
              ))}
              {!drawerLoading && drawerItems.length === 0 && (
                <p className="text-sm text-slate-500">Nothing here yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      </main>
  );
}
