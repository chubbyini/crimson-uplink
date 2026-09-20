"use client";

import React, { useState } from "react";
import DataDisintegrator from "./DataDisintegrator";

interface SampleTrend {
  title: string;
  source: string;
  score: number;
  angle: string;
  draftDevTo: string;
  draftLinkedIn: string;
}

const sampleTrends: SampleTrend[] = [
  {
    title: "React 19 Async Transitions & Server Actions Deep Dive",
    source: "Hacker News (Algolia) + GitHub Stars",
    score: 96,
    angle: "Architectural comparison: Why async transitions revolutionize bio-tech HUD real-time renders without client jank.",
    draftDevTo: `---
title: How React 19 Async Transitions Power Ultra-Responsive Bio-Mech UIs
published: true
tags: react, webdev, architecture, javascript
canonical_url: https://crimsonuplink.dev/react19-biomech
---

When engineering high-frequency control interfaces for living mechs, UI latency isn't just an annoyance—it's a critical telemetry bottleneck.

### The Problem with Synchronous State Mutators
Traditional state updates lock main-thread execution during heavy DOM mutations.

\`\`\`tsx
// Traditional sync dispatch
const handleNeuralSync = (data: BioData) => {
  setPulseState(data); // Causes frame drop!
};
\`\`\`

### Enter React 19 \`useTransition\` & Action Vectors
React 19 non-blocking transitions allow background data streams to resolve gracefully:

\`\`\`tsx
import { useTransition } from 'react';

export function BioNeuralDeck() {
  const [isPending, startTransition] = useTransition();

  const handlePulse = (pulse: PulseSignal) => {
    startTransition(async () => {
      await uplinkSpiritCore(pulse);
    });
  };

  return <HUDOverlay active={!isPending} />;
}
\`\`\`

**Key Takeaways:**
1. Zero main-thread blocking during complex SVG vein calculations.
2. Concurrent rendering keeps interactive HUD elements locked at 60 FPS.
`,
    draftLinkedIn: `🔥 React 19 Async Transitions are a game-changer for high-performance frontend interfaces.

If you're building complex data visualizers or real-time dashboards, synchronous state updates often cause main-thread jank.

Here is how React 19 solves it:
1️⃣ Non-blocking state dispatches with useTransition()
2️⃣ Native Server Actions eliminating boilerplate API fetch handlers
3️⃣ Seamless background stream resolution

Check out the full technical breakdown on Dev.to (link below)! 🚀

#ReactJS #WebDevelopment #FrontendEngineering #SoftwareArchitecture`,
  },
  {
    title: "Autonomous Agentic Workflows with Gemini 2.0 & Groq Llama 3.3",
    source: "Bluesky + GitHub Trending",
    score: 92,
    angle: "Dual-Brain Architecture: Gemini handles structural schema scoring while Groq powers ultra-fast prose voice.",
    draftDevTo: `---
title: Dual-Brain AI Architecture: Combining Gemini 2.0 and Groq Llama 3.3
published: true
tags: ai, LLM, groq, gemini
---

Single-LLM pipelines frequently suffer from a classic trade-off: reasoning depth versus prose fluency and generation speed.

### The Solution: The Dual-Brain Matrix
By splitting responsibilities between specialized models:
- **Gemini 2.0 Flash Lite**: Extracts structured JSON metadata, dedupes URLs, and scores virality angles.
- **Groq Llama 3.3 70B**: Takes the scored structure and drafts naturally in the developer's exact authorial voice.

\`\`\`typescript
const score = await gemini.generateObject({ schema: ideaScoreSchema });
const draft = await groq.generateText({ prompt: buildVoicePrompt(score) });
\`\`\`

Result: 1.6-second end-to-end draft generation with 0% hallucinated structure.
`,
    draftLinkedIn: `🤖 Why use one LLM when you can deploy a Dual-Brain Architecture?

In our latest content engine benchmark:
🧠 Gemini 2.0 Flash handles JSON schema validation & trend scoring in <500ms
✍️ Groq Llama 3.3 70B synthesizes natural developer prose in 1.2s

The result? High-accuracy drafts delivered directly to phone in under 2 seconds.

How are you structuring your multi-LLM pipelines? Let's discuss below! 👇

#ArtificialIntelligence #LLM #SoftwareEngineering #TechTrends`,
  },
];

export default function BioMechSimulator() {
  const [selectedTrendIdx, setSelectedTrendIdx] = useState<number>(0);
  const [step, setStep] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"devto" | "linkedin">("devto");
  const [isApproved, setIsApproved] = useState<boolean>(false);

  const activeTrend = sampleTrends[selectedTrendIdx];

  const handleHarvest = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setStep(2);
    }, 1000);
  };

  const handleDraft = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setStep(3);
    }, 1200);
  };

  const handleSimulateTelegram = () => {
    setStep(4);
  };

  const handleApprove = () => {
    setIsApproved(true);
  };

  const handleReset = () => {
    setStep(1);
    setIsApproved(false);
  };

  return (
    <div className="space-y-6">
      {/* Interactive Disintegration Component */}
      <DataDisintegrator />

      {/* Test Chamber Control Deck */}
      <div className="mta-card rounded-2xl p-6 shadow-[0_0_30px_rgba(56,189,248,0.1)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
              SIMULATION CONTROL DECK
            </span>
            <h3 className="text-xl font-bold text-white">
              Interactive Trend-to-Publish Pipeline
            </h3>
          </div>

          {/* Step Indicator Pills */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border font-bold transition-all ${
                  step === s
                    ? "border-sky-400 bg-sky-600 text-white shadow-[0_0_10px_#38bdf8]"
                    : step > s
                    ? "border-sky-900/60 bg-sky-950/40 text-sky-400"
                    : "border-slate-800 bg-slate-900 text-slate-600"
                }`}
              >
                0{s}
              </span>
            ))}
          </div>
        </div>

        {/* STEP 1: SELECT TREND */}
        {step === 1 && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-300">
              Select a real-time developer trend harvested by Crimson Uplink cron poller:
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              {sampleTrends.map((trend, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedTrendIdx(idx)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                    selectedTrendIdx === idx
                      ? "border-sky-500 bg-sky-950/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <span className="font-mono text-[10px] uppercase text-sky-400 font-bold block mb-1">
                      SOURCE: {trend.source}
                    </span>
                    <p className="text-sm font-bold text-white leading-snug">
                      {trend.title}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
                    <span className="text-slate-400">Virality Score</span>
                    <span className="font-mono font-bold text-sky-400">
                      {trend.score}/100
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleHarvest}
                disabled={isSimulating}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 font-mono text-sm font-bold text-white shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-95"
              >
                {isSimulating ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    HARVESTING TREND DATA...
                  </>
                ) : (
                  <>
                    INITIALIZE HARVEST & SCORE ›
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: GEMINI AI SCORING */}
        {step === 2 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-sky-400 uppercase">
                  GEMINI 2.0 FLASH LITE // IDEA ANALYSIS
                </span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  SCORE: {activeTrend.score}/100
                </span>
              </div>

              <h4 className="mt-2 text-lg font-bold text-white">
                {activeTrend.title}
              </h4>

              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
                <span className="font-mono text-[10px] text-slate-500 uppercase block mb-1">
                  SUGGESTED TECHNICAL ANGLE
                </span>
                <p className="text-sm text-slate-200 italic">
                  &quot;{activeTrend.angle}&quot;
                </p>
              </div>

              {/* Score Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1 font-mono">
                  <span>RELEVANCE MATRIX</span>
                  <span>{activeTrend.score}% OPTIMAL</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 shadow-[0_0_8px_#38bdf8] transition-all duration-1000"
                    style={{ width: `${activeTrend.score}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-800 px-4 py-2.5 font-mono text-xs text-slate-400 hover:bg-slate-900"
              >
                ‹ BACK TO SOURCES
              </button>
              <button
                onClick={handleDraft}
                disabled={isSimulating}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-2.5 font-mono text-sm font-bold text-white shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all hover:from-sky-400 hover:to-blue-500"
              >
                {isSimulating ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    GROQ SYNTHESIZING VOICE...
                  </>
                ) : (
                  <>
                    SYNTHESIZE GROQ DRAFT ›
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DRAFT PREVIEW */}
        {step === 3 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("devto")}
                  className={`px-3 py-1 font-mono text-xs font-bold rounded-md transition-all ${
                    activeTab === "devto"
                      ? "bg-sky-600 text-white shadow-[0_0_10px_#38bdf8]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  DEV.TO MARKDOWN
                </button>
                <button
                  onClick={() => setActiveTab("linkedin")}
                  className={`px-3 py-1 font-mono text-xs font-bold rounded-md transition-all ${
                    activeTab === "linkedin"
                      ? "bg-sky-600 text-white shadow-[0_0_10px_#38bdf8]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  LINKEDIN POST MATRIX
                </button>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                VOICE: GROQ LLAMA-3.3 70B
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
              <pre className="whitespace-pre-wrap font-mono">
                {activeTab === "devto"
                  ? activeTrend.draftDevTo
                  : activeTrend.draftLinkedIn}
              </pre>
            </div>

            <div className="flex justify-between gap-3">
              <button
                onClick={() => setStep(2)}
                className="rounded-xl border border-slate-800 px-4 py-2.5 font-mono text-xs text-slate-400 hover:bg-slate-900"
              >
                ‹ RE-SCORE ANGLE
              </button>
              <button
                onClick={handleSimulateTelegram}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-2.5 font-mono text-sm font-bold text-white shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all hover:from-sky-400 hover:to-blue-500"
              >
                PUSH TO TELEGRAM GATE ›
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: TELEGRAM GATE INTERACTIVE CARD */}
        {step === 4 && (
          <div className="mt-6 space-y-4">
            {!isApproved ? (
              <div className="mx-auto max-w-md rounded-2xl border border-sky-500/40 bg-slate-900 p-5 shadow-[0_0_30px_rgba(14,165,233,0.15)]">
                {/* Telegram Header */}
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white font-bold">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.16l-2.07 9.77c-.15.7-.57.87-1.16.54l-3.21-2.37-1.55 1.49c-.17.17-.32.32-.65.32l.23-3.26 5.94-5.37c.26-.23-.06-.36-.4-.14l-7.34 4.62-3.16-.99c-.69-.21-.7-.69.14-1.02l12.36-4.76c.57-.21 1.07.14.85 1.17z" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">
                      Crimson Uplink Bot
                    </h5>
                    <p className="text-[11px] text-sky-400">
                      Telegram Approval Gate // Pending Action
                    </p>
                  </div>
                </div>

                {/* Telegram Body */}
                <div className="mt-3 text-xs text-slate-200 leading-relaxed">
                  <p className="font-bold text-sky-300 mb-1">
                    🚨 New Draft Ready for Review:
                  </p>
                  <p className="font-semibold">{activeTrend.title}</p>
                  <p className="text-slate-400 mt-1 line-clamp-2">
                    {activeTrend.angle}
                  </p>
                </div>

                {/* Inline Keyboard Buttons */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={handleApprove}
                    className="rounded-lg bg-emerald-600 py-2.5 font-mono text-xs font-bold text-white hover:bg-emerald-500 shadow-md transition-all active:scale-95"
                  >
                    ✅ APPROVE & PUBLISH
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="rounded-lg bg-slate-800 py-2.5 font-mono text-xs font-medium text-slate-300 hover:bg-slate-700"
                  >
                    ✏️ EDIT DRAFT
                  </button>
                </div>
              </div>
            ) : (
              /* Successful Uplink State */
              <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/30 p-6 text-center shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-2xl border border-emerald-500/40 animate-bounce">
                  ✓
                </div>
                <h4 className="mt-3 text-xl font-bold text-white">
                  BROADCAST UPLINK SUCCESSFUL!
                </h4>
                <p className="mt-1 text-sm text-emerald-300">
                  Published to Dev.to via REST API & LinkedIn matrix unlocked.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleReset}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-2.5 font-mono text-xs font-bold text-white hover:border-sky-500"
                  >
                    SIMULATE ANOTHER TREND
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
