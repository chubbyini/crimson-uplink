"use client";

import React, { useState } from "react";

export default function DataDisintegrator() {
  const [isDisintegrated, setIsDisintegrated] = useState<boolean>(false);

  // Particle matrices for the disintegration effect
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: 40 + (i % 7) * 45,
    y: 30 + Math.floor(i / 7) * 35,
    dx: (Math.sin(i) * 60).toFixed(1),
    dy: (-Math.cos(i) * 50 - 20).toFixed(1),
    color: i % 2 === 0 ? "#38bdf8" : "#ff2a55",
    size: 3 + (i % 4),
  }));

  return (
    <div className="mta-card rounded-2xl p-6 shadow-[0_0_30px_rgba(56,189,248,0.1)]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
              SVG QUANTUM DISINTEGRATOR & RE-SYNTHESIZER
            </span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-white">
            Unstructured Data Disintegration Engine
          </h3>
        </div>

        {/* Action Toggle */}
        <button
          onClick={() => setIsDisintegrated(!isDisintegrated)}
          className="flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/40 px-4 py-2 font-mono text-xs font-bold text-sky-300 transition-all hover:bg-sky-900/50 hover:border-sky-400 active:scale-95"
        >
          <span>{isDisintegrated ? "⚡ RE-SYNTHESIZE MATRIX" : "💥 DISINTEGRATE RAW FEEDS"}</span>
        </button>
      </div>

      {/* Interactive SVG Disintegration Stage */}
      <div className="relative mt-6 flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-slate-950/80 p-8 overflow-hidden min-h-[260px]">
        <svg
          className="w-full max-w-lg h-52"
          viewBox="0 0 400 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="particleGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Central Neural Spirit Core Ring */}
          <circle
            cx="200"
            cy="100"
            r="45"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="animate-spin"
            style={{ animationDuration: "14s" }}
          />
          <circle
            cx="200"
            cy="100"
            r="25"
            stroke="#ff2a55"
            strokeWidth="1.5"
            className="animate-pulse"
          />

          {/* Source Data Block (Disintegrates) */}
          <g
            className="transition-all duration-700 ease-out"
            style={{
              opacity: isDisintegrated ? 0.2 : 1,
              transform: isDisintegrated ? "scale(0.85)" : "scale(1)",
              transformOrigin: "200px 100px",
            }}
          >
            <rect x="60" y="70" width="80" height="60" rx="8" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
            <text x="72" y="95" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">RAW RSS</text>
            <text x="72" y="112" fill="#94a3b8" fontSize="9" fontFamily="monospace">UNSTRUCTURED</text>

            <rect x="260" y="70" width="80" height="60" rx="8" fill="#0f172a" stroke="#ff2a55" strokeWidth="1" />
            <text x="272" y="95" fill="#ff2a55" fontSize="10" fontFamily="monospace" fontWeight="bold">GITHUB</text>
            <text x="272" y="112" fill="#94a3b8" fontSize="9" fontFamily="monospace">TREND FEEDS</text>
          </g>

          {/* Disintegrating Quantum Particle Cloud */}
          <g filter="url(#particleGlow)">
            {particles.map((p) => (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r={p.size}
                fill={p.color}
                className="transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1)"
                style={{
                  transform: isDisintegrated
                    ? `translate(${p.dx}px, ${p.dy}px) scale(1.4)`
                    : "translate(0px, 0px) scale(1)",
                  opacity: isDisintegrated ? 0.9 : 0.4,
                  transformOrigin: `${p.x}px ${p.y}px`,
                }}
              />
            ))}
          </g>
        </svg>

        {/* Dynamic Status Text */}
        <div className="mt-2 text-center">
          <p className="font-mono text-xs font-bold text-white">
            {isDisintegrated
              ? "STATUS: DATA DISINTEGRATED INTO QUANTUM PARSING NODES"
              : "STATUS: RAW NOISE HARVESTED // READY FOR NEURAL SYNTHESIS"}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 max-w-md">
            {isDisintegrated
              ? "Gemini 2.0 Flash extracts metadata & dedupes hashes from particle fragments."
              : "Click the toggle button to trigger the SVG disintegration & re-synthesis preview."}
          </p>
        </div>
      </div>
    </div>
  );
}
