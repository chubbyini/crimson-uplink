"use client";

import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { PageSkeleton } from "@/components/Skeletons";
import type { CorpusItem, VoiceProfile } from "@/lib/corpus/types";

export default function CorpusPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [items, setItems] = useState<CorpusItem[]>([]);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "analyzing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [ingestInfo, setIngestInfo] = useState<string | null>(null);

  // Form for multiple custom articles
  const [customArticles, setCustomArticles] = useState<Array<{ title: string; content: string }>>([
    { title: "", content: "" },
  ]);

  async function loadCorpus(u: User) {
    setStatus("loading");
    try {
      const token = await u.getIdToken();
      const res = await fetch("/api/corpus", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load corpus");

      setItems(data.items || []);
      setVoiceProfile(data.voiceProfile || null);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load corpus");
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
    void loadCorpus(user);
  }, [user, authLoading, router]);

  function addArticleField() {
    setCustomArticles((prev) => [...prev, { title: "", content: "" }]);
  }

  function updateArticleField(index: number, key: "title" | "content", val: string) {
    setCustomArticles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: val } : item))
    );
  }

  function removeArticleField(index: number) {
    setCustomArticles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleIngest(options: { syncDevto?: boolean; syncGithub?: boolean }) {
    if (!user) return;
    setStatus("saving");
    setError(null);
    setIngestInfo(null);
    try {
      const token = await user.getIdToken();
      const validCustom = customArticles.filter((a) => a.content.trim().length > 20);

      const res = await fetch("/api/corpus", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          syncDevto: options.syncDevto,
          syncGithub: options.syncGithub,
          articles: validCustom,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingestion failed");

      const parts = [`Added ${data.added ?? 0} new`];
      if (typeof data.duplicates === "number" && data.duplicates > 0) {
        parts.push(`${data.duplicates} already imported`);
      }
      if (typeof data.total === "number") parts.push(`${data.total} total`);
      setIngestInfo(
        data.note ? `${parts.join(" · ")} — ${data.note}` : parts.join(" · ")
      );

      setCustomArticles([{ title: "", content: "" }]);
      await loadCorpus(user);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ingestion failed";
      setError(msg);
      toast.error(msg);
      setStatus("error");
    }
  }

  async function triggerVoiceAnalysis() {
    if (!user) return;
    setStatus("analyzing");
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/corpus/analyze", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Voice analysis failed");

      setVoiceProfile(data.voiceProfile);
      toast.success(`Voice guide generated from ${data.voiceProfile?.sampleCount ?? "your"} samples ✓`);
      setStatus("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Voice analysis failed";
      setError(msg);
      toast.error(msg);
      setStatus("error");
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Authorial Voice Corpus</h1>
        <p className="mt-4 text-slate-400">Configure Firebase first.</p>
      </main>
    );
  }

  if (authLoading) return <PageSkeleton title="Authorial Voice Corpus" />;
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Authorial Voice Corpus</h1>
        <p className="mt-4 text-slate-400">Sign in to manage your voice corpus.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-full bg-red-500/20 px-3 py-1 font-mono text-xs font-semibold text-red-500 uppercase">
            Agentic Authorial Engine
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Own-Writing Corpus & Voice Profile</h1>
          <p className="mt-1 text-sm text-slate-400">
            Import past articles, READMEs, or paste writing samples. Gemini extracts your unique authorial voice guide to power all future Groq & Gemini drafts.
          </p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      {ingestInfo && status !== "error" && (
        <p className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-400">
          ✓ {ingestInfo}
        </p>
      )}

      {/* Action Buttons Header */}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => handleIngest({ syncDevto: true })}
          disabled={status === "saving" || status === "loading"}
          className="btn-ghost"
        >
          🔄 Sync Dev.to Articles
        </button>
        <button
          onClick={() => handleIngest({ syncGithub: true })}
          disabled={status === "saving" || status === "loading"}
          className="btn-ghost"
        >
          🐙 Sync GitHub READMEs
        </button>
        <button
          onClick={triggerVoiceAnalysis}
          disabled={status === "analyzing" || !items.length}
          className="rounded-full bg-red-700 px-5 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50 shadow-lg"
        >
          {status === "analyzing" ? "Analyzing Voice with Gemini…" : "✨ Generate Agentic Voice Guide"}
        </button>
      </div>

      {/* Form: Paste Multiple Custom Articles */}
      <section className="ui-panel mt-8 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-100">Add Custom Writing Samples</h2>
        <p className="mt-1 text-xs text-slate-500">
          Paste one or more past articles, blog posts, or essays you have written. You can add multiple samples at once.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleIngest({});
          }}
          className="mt-4 flex flex-col gap-4"
        >
          {customArticles.map((art, idx) => (
            <div key={idx} className="rounded-xl border border-slate-800 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  Sample #{idx + 1}
                </span>
                {customArticles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArticleField(idx)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Article Title (Optional)"
                value={art.title}
                onChange={(e) => updateArticleField(idx, "title", e.target.value)}
                className="input mt-2 text-xs"
              />
              <textarea
                rows={5}
                placeholder="Paste complete article text or written content here..."
                value={art.content}
                onChange={(e) => updateArticleField(idx, "content", e.target.value)}
                className="input mt-2 p-3 text-xs"
              />
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={addArticleField}
              className="rounded-full border border-dashed border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
            >
              + Add Another Sample
            </button>

            <button
              type="submit"
              disabled={status === "saving"}
              className="btn-primary"
            >
              {status === "saving" ? "Saving Samples…" : "Save Custom Samples"}
            </button>
          </div>
        </form>
      </section>

      {/* Active Agentic Voice Profile Section */}
      {voiceProfile && (
        <section className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-red-700 px-3 py-1 text-xs font-bold text-white uppercase">
                Active Voice Guide
              </span>
              <span className="text-xs text-slate-500">
                Learned from {voiceProfile.sampleCount} samples · Last analyzed {new Date(voiceProfile.lastAnalyzedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-black/30 p-4">
              <h3 className="text-xs font-bold text-red-400 uppercase">Tone & Style</h3>
              <p className="mt-1 text-xs text-slate-300">{voiceProfile.toneSummary}</p>
            </div>
            <div className="rounded-xl bg-black/30 p-4">
              <h3 className="text-xs font-bold text-red-400 uppercase">Sentence Cadence & Rhythm</h3>
              <p className="mt-1 text-xs text-slate-300">{voiceProfile.sentenceCadence}</p>
            </div>
            <div className="rounded-xl bg-black/30 p-4">
              <h3 className="text-xs font-bold text-red-400 uppercase">Hook Technique</h3>
              <p className="mt-1 text-xs text-slate-300">{voiceProfile.hookStyle}</p>
            </div>
            <div className="rounded-xl bg-black/30 p-4">
              <h3 className="text-xs font-bold text-red-400 uppercase">Code & Technical Depth</h3>
              <p className="mt-1 text-xs text-slate-300">{voiceProfile.codeFormattingStyle}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-black/30 p-4">
            <h3 className="text-xs font-bold text-red-400 uppercase">Injected System Prompt</h3>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs whitespace-pre-wrap font-mono text-slate-200">
              {voiceProfile.styleGuidePrompt}
            </pre>
          </div>

          {/* Content Gaps & Repurposing Candidates */}
          {voiceProfile.gapsAndFollowups && voiceProfile.gapsAndFollowups.length > 0 && (
            <div className="mt-6 border-t border-red-500/20 pt-4">
              <h3 className="text-sm font-bold text-slate-100">
                AI-Identified Content Gaps & Follow-Up Opportunities
              </h3>
              <div className="mt-3 flex flex-col gap-3">
                {voiceProfile.gapsAndFollowups.map((gap, i) => (
                  <div key={i} className="ui-panel p-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-red-700/10 px-2 py-0.5 font-mono text-xs uppercase text-red-400">
                        {gap.format}
                      </span>
                      <span className="text-xs font-bold text-slate-100">{gap.topic}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-300">Angle: {gap.angle}</p>
                    <p className="mt-1 text-xs text-slate-500">Rationale: {gap.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Imported Samples List */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-100">Imported Samples ({items.length})</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="ui-panel p-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="meta-pill uppercase">
                  {item.source}
                </span>
                <span className="font-mono text-slate-500">{item.wordCount} words</span>
                <span className="text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="mt-1 text-base font-semibold text-slate-100">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.body}</p>
            </li>
          ))}
        </ul>
        {!items.length && (
          <p className="mt-4 text-xs text-slate-500">No samples ingested yet. Paste custom articles or sync Dev.to/GitHub above.</p>
        )}
      </section>
    </main>
  );
}
