"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { PageSkeleton } from "@/components/Skeletons";
import MechCycleTabs from "@/components/pair/MechCycleTabs";

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

const QUICK_CMDS = ["/rewrite", "/critique", "/critique deep", "/ship", "/end"];

export default function PairPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
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
  const [newArticleTitle, setNewArticleTitle] = useState<string | null>(null);
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
      const data = await authed("/api/pair");
      setSessions(data.sessions ?? []);
    } catch {
      // List is best-effort; an open session still works.
    }
  }, [authed]);

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
    let entry;
    try {
      entry = buildEntry();
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
        body: JSON.stringify({ entry, mode: seedMode }),
      });
      setSession(data as PairSession);
      setShowLauncher(false);
      setSeedText("");
      setSeedTitle("");
      await loadSessions();
      toast.success("Pair session open ✓");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start session";
      setError(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
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
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Session rail */}
        <aside className="ui-panel h-fit p-3">
          <h2 className="px-2 font-mono text-[10px] tracking-widest text-slate-500">SESSIONS</h2>
          {sessions.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-500">No sessions yet — launch one.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s.id)}
              className={`mt-1 block w-full rounded-lg px-2 py-2 text-left hover:bg-white/5 ${session?.id === s.id ? "bg-white/5" : ""}`}
            >
              <span className="block truncate text-sm text-slate-200">{s.title}</span>
              <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                {s.mode} · {s.phase} · {s.articleCount}a · {s.status}
              </span>
            </button>
          ))}
        </aside>

        <section>
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
              <textarea
                rows={seedKind === "blank" || seedKind === "idea" || seedKind === "draft" ? 2 : 6}
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                placeholder={
                  seedKind === "idea" ? "Idea ID (from Ideas page)"
                  : seedKind === "draft" ? "Draft ID (from Drafts page)"
                  : seedKind === "blank" ? "What should we write about?"
                  : seedKind === "excerpts" ? "Paste source material…"
                  : "Paste or write your paragraph…"
                }
                className="input mt-3"
              />
              <button onClick={startSession} disabled={starting} className="btn-primary mt-3 h-10 px-5">
                {starting ? "Opening…" : "Open pair session"}
              </button>
            </div>
          )}

          {session && !showLauncher && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="meta-pill">{session.mode}</span>
                <span className="meta-pill">phase: {session.phase}</span>
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
                <div className="ui-panel flex min-h-[24rem] flex-col p-4">
                  <div ref={threadRef} className="flex max-h-[32rem] flex-1 flex-col gap-3 overflow-y-auto pr-1">
                    {session.history.map((t, i) => (
                      <div
                        key={i}
                        className={`max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
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
                <div className="ui-panel flex min-h-[24rem] flex-col p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-200">
                      {active ? `#${activeIdx + 1} ${active.title}` : "No article"}
                    </h3>
                    <span className="meta-pill ml-auto">{active?.status}</span>
                  </div>
                  <pre className="mt-2 max-h-[32rem] flex-1 overflow-y-auto rounded-lg bg-black/30 p-3 font-mono text-xs whitespace-pre-wrap text-slate-300">
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
    </main>
  );
}
