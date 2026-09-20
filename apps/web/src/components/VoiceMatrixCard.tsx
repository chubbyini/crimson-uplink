"use client";

import React from "react";

export default function VoiceMatrixCard() {
  return (
    <div className="mta-card rounded-2xl p-6 shadow-[0_0_30px_rgba(56,189,248,0.1)]">
      <div className="grid gap-6 md:grid-cols-12 items-center">
        {/* Left Column: Description */}
        <div className="md:col-span-7 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
              DUAL-BRAIN AI ARCHITECTURE
            </span>
          </div>

          <h3 className="text-2xl font-bold text-white">
            Rationalized Voice Matrix & Synthesis Engine
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed">
            Standard AI drafting models produce generic prose. Crimson Uplink combines <strong className="text-white">Gemini 2.0 Flash Lite</strong> for analytical scoring & structural accuracy with <strong className="text-white">Groq Llama-3.3 70B</strong> trained on your personal <code className="text-sky-300 font-mono text-xs">style.md</code> persona.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="font-mono text-[10px] text-sky-400 font-bold uppercase">
                BRAIN 1: GEMINI 2.0
              </p>
              <p className="text-xs font-semibold text-white mt-0.5">
                Analytical Dedupe & Virality Scoring
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="font-mono text-[10px] text-rose-400 font-bold uppercase">
                BRAIN 2: GROQ LLAMA 3.3
              </p>
              <p className="text-xs font-semibold text-white mt-0.5">
                Authentic Human Developer Voice
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Animated Waveform / Spirit Core Visualizer */}
        <div className="md:col-span-5 flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
          {/* Animated Glowing Core Sphere */}
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-dashed border-sky-400/60 animate-spin" style={{ animationDuration: "14s" }} />
            <div className="absolute inset-2 rounded-full border border-rose-500/40 animate-pulse" />
            <div className="h-12 w-12 rounded-full bg-slate-900 border border-sky-400 text-sky-300 font-mono font-bold text-xs flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.3)]">
              CORE
            </div>
          </div>

          {/* Equalizer Bar Animation */}
          <div className="mt-5 flex items-end justify-center gap-1.5 h-10 w-full px-4">
            {[40, 75, 55, 90, 65, 80, 45, 95, 60, 85, 50].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-gradient-to-t from-sky-600 to-rose-500 opacity-80"
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>

          <span className="mt-3 font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            SYNTHESIS SPECTRUM // 100% BYOK ENCRYPTED
          </span>
        </div>
      </div>
    </div>
  );
}
