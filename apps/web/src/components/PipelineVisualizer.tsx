"use client";

import React, { useState } from "react";

interface PipelineStage {
  id: string;
  step: string;
  name: string;
  codename: string;
  desc: string;
  tech: string[];
  brains: string;
  telemetry: {
    latency: string;
    throughput: string;
    reliability: string;
    status: string;
  };
  details: string[];
}

const pipelineStages: PipelineStage[] = [
  {
    id: "sources",
    step: "01",
    name: "Bio-Sources Harvester",
    codename: "HYDRA-FEED-MATRIX",
    desc: "Autonomous morning scanner polling tech feeds, GitHub trends & developer discussions.",
    tech: ["RSS Parser", "Bluesky API", "Mastodon", "HackerNews Algolia", "GitHub Stars", "npm Trends"],
    brains: "Multi-Channel Poller",
    telemetry: {
      latency: "1.2s avg scan",
      throughput: "500+ items/day",
      reliability: "99.9%",
      status: "ACTIVE MONITORS",
    },
    details: [
      "Normalizes raw URLs & deduplicates via cryptographic SHA-256 hashes.",
      "Filters noise & avoids paywalled feeds (direct RSS + ATProtocol integration).",
      "Per-user custom RSS & social source subscriptions stored in Firestore.",
    ],
  },
  {
    id: "ideabank",
    step: "02",
    name: "Spirit Idea Bank",
    codename: "GEMINI-NEURAL-SCORE",
    desc: "Scores, contextualizes, and extracts high-impact post angles per developer persona.",
    tech: ["Gemini 2.0 Flash Lite", "Zod Structured Output", "Firestore User DB"],
    brains: "Gemini 2.0 (Structure Brain)",
    telemetry: {
      latency: "800ms / 50 items",
      throughput: "Top 5 Daily Candidates",
      reliability: "100% Schema Valid",
      status: "ANALYZING TRENDS",
    },
    details: [
      "Ranks top 5 ideas based on audience interest, virality potential & user style match.",
      "Generates unique post angles, canonical source references & suggested formats.",
      "Isolates data per user under `users/{uid}/ideas` with strict security rules.",
    ],
  },
  {
    id: "drafter",
    step: "03",
    name: "Dual-Brain Bio-Drafter",
    codename: "GROQ-VOICE-SYNTH",
    desc: "Synthesizes prose in your distinct technical voice using Groq Llama-3.3 70B.",
    tech: ["Groq Llama-3.3-70B", "Vercel AI SDK", "Markdown Generator", "style.md Matrix"],
    brains: "Groq (Voice) + Gemini (Structure)",
    telemetry: {
      latency: "1.6s generation",
      throughput: "3000 chars / draft",
      reliability: "Zero Hallucination Gate",
      status: "SYNTHESIZING PROSE",
    },
    details: [
      "Injects user's personal `style.md` guidelines & past post samples into Groq Llama-3.3.",
      "Structures technical code blocks, key takeaways, and platform-optimized line breaks.",
      "Gemini handles structure validation; Groq delivers natural human authorial tone.",
    ],
  },
  {
    id: "approval",
    step: "04",
    name: "Telegram Neural Gate",
    codename: "HUMAN-IN-THE-LOOP-BOT",
    desc: "Direct-to-phone review system. Nothing posts without your explicit authorization.",
    tech: ["grammY Bot Framework", "Inline Keyboard Callbacks", "Vercel Edge Webhooks"],
    brains: "Human Command Overrule",
    telemetry: {
      latency: "< 100ms callback",
      throughput: "Instant Push to Phone",
      reliability: "Zero Blind Auto-Posts",
      status: "WAITING FOR SIGNAL",
    },
    details: [
      "Two-gate review: Gate 1 (Approve/Skip Idea), Gate 2 (Approve/Edit/Reject Draft).",
      "Receive rich draft previews with tap-to-publish or tap-to-edit inline buttons.",
      "Secure callback parameters verify `uid` and `chatId` before executing actions.",
    ],
  },
  {
    id: "publish",
    step: "05",
    name: "Multi-Platform Uplink",
    codename: "CRIMSON-UPLINK-TARGET",
    desc: "Publishes directly via APIs or outputs formatted copy-ready text with analytics sync.",
    tech: ["Dev.to REST API", "LinkedIn Copy-Matrix", "Canonical URL Sync", "Medium Import"],
    brains: "Multi-Target Broadcast",
    telemetry: {
      latency: "350ms Dev.to API",
      throughput: "Multi-Channel Broadcast",
      reliability: "100% Delivery Rate",
      status: "UPLINK READY",
    },
    details: [
      "Automated Dev.to publishing with original canonical URL tag for SEO protection.",
      "Copy-ready LinkedIn post formatter with 3,000-character constraint verification.",
      "Nightly Dev.to view count auto-sync & manual LinkedIn analytics tracking.",
    ],
  },
];

export default function PipelineVisualizer() {
  const [activeStageId, setActiveStageId] = useState<string>("ideabank");

  const activeStage =
    pipelineStages.find((s) => s.id === activeStageId) || pipelineStages[1];

  return (
    <div className="mta-card rounded-2xl p-6 shadow-[0_0_30px_rgba(56,189,248,0.1)]">
      {/* Top Console Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500"></span>
          </span>
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
              PRECISION PIPELINE MATRIX
            </h3>
            <p className="text-xs text-slate-400">
              High-Frequency Architecture & Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 font-mono text-xs text-sky-300">
          <span className="opacity-60">STATUS:</span>
          <span className="font-semibold text-sky-400 animate-pulse">
            {activeStage.telemetry.status}
          </span>
        </div>
      </div>

      {/* 5-Stage Pipeline Node Navigation Bar */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {pipelineStages.map((stage) => {
          const isActive = stage.id === activeStageId;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStageId(stage.id)}
              className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-300 ${
                isActive
                  ? "border-sky-500 bg-sky-950/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                  : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80"
              }`}
            >
              {/* Active Top Highlight Line */}
              {isActive && (
                <div className="absolute top-0 left-3 right-3 h-0.5 bg-gradient-to-r from-sky-400 to-rose-500 shadow-[0_0_8px_#38bdf8]" />
              )}

              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-xs font-semibold ${
                    isActive ? "text-sky-400" : "text-slate-500 group-hover:text-sky-400"
                  }`}
                >
                  [{stage.step}]
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    isActive
                      ? "bg-sky-400 shadow-[0_0_6px_#38bdf8] animate-pulse"
                      : "bg-slate-700"
                  }`}
                />
              </div>

              <div className="mt-2.5">
                <p
                  className={`text-sm font-bold tracking-tight ${
                    isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                  }`}
                >
                  {stage.name}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-500 uppercase tracking-widest truncate">
                  {stage.codename}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Stage Bio Telemetry Inspector */}
      <div className="mt-6 grid gap-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5 md:grid-cols-12">
        {/* Left Info Panel */}
        <div className="md:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-sky-400 uppercase">
                STAGE {activeStage.step} INSPECTOR
              </span>
              <span className="text-slate-600">{"//"}</span>
              <span className="font-mono text-xs text-slate-400">
                {activeStage.codename}
              </span>
            </div>

            <h4 className="mt-2 text-xl font-bold text-white">
              {activeStage.name}
            </h4>

            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              {activeStage.desc}
            </p>

            {/* Feature Bullets */}
            <ul className="mt-4 space-y-2">
              {activeStage.details.map((detail, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="mt-1 text-sky-400 font-bold">›</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech Badges */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block mb-2">
              ENGINE STACK & INTEGRATIONS
            </span>
            <div className="flex flex-wrap gap-2">
              {activeStage.tech.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-sky-900/40 bg-sky-950/30 px-2.5 py-1 font-mono text-[11px] text-sky-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Telemetry Gauges */}
        <div className="md:col-span-5 flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400 font-bold block mb-3">
              TELEMETRY SPECS
            </span>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs text-slate-400">AI BRAIN ENGINE</span>
                <span className="font-mono text-xs font-semibold text-sky-300">
                  {activeStage.brains}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs text-slate-400">LATENCY BENCHMARK</span>
                <span className="font-mono text-xs font-semibold text-slate-200">
                  {activeStage.telemetry.latency}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs text-slate-400">THROUGHPUT VOLUME</span>
                <span className="font-mono text-xs font-semibold text-slate-200">
                  {activeStage.telemetry.throughput}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">RELIABILITY INDEX</span>
                <span className="font-mono text-xs font-semibold text-emerald-400">
                  {activeStage.telemetry.reliability}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Radar Visual */}
          <div className="relative mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8 rounded-full border border-sky-500/50 bg-slate-950 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 border-t border-sky-400 animate-radar" />
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ff2a55]" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-bold text-sky-300">
                  QUANTUM SYNC MATRIX
                </p>
                <p className="text-[10px] text-slate-400">
                  Precision Bio-Neural Core
                </p>
              </div>
            </div>
            <span className="font-mono text-xs text-sky-400 font-bold">100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
