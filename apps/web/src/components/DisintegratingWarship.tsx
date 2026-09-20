"use client";

import React, { useEffect, useState } from "react";

export default function DisintegratingWarship() {
  // Phase: 0 = fully assembled, 1 = disintegrating/scattered, 2 = re-integrating
  const [phase, setPhase] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((prev) => (prev + 1) % 3);
    }, 3800); // Cycles every 3.8s between assembled, disintegrated, and re-assembling

    return () => clearInterval(timer);
  }, []);

  const isDisintegrated = phase === 1;
  const isReintegrating = phase === 2;

  // 36 particles with deterministic scatter paths
  const hullParticles = Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * Math.PI * 2;
    const distance = 40 + (i % 6) * 15;
    return {
      id: i,
      x: 170 + (i % 9) * 20,
      y: 50 + Math.floor(i / 9) * 16,
      dx: (Math.cos(angle) * distance + (i % 2 === 0 ? 25 : -25)).toFixed(1),
      dy: (Math.sin(angle) * distance - 20).toFixed(1),
      color: i % 3 === 0 ? "#38bdf8" : i % 3 === 1 ? "#ff2a55" : "#f1f5f9",
      size: 2 + (i % 3),
    };
  });

  return (
    <div
      onClick={() => setPhase((prev) => (prev + 1) % 3)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 backdrop-blur-md transition-all hover:border-sky-500/50 hover:shadow-[0_0_25px_rgba(56,189,248,0.15)]"
      title="Automatic Timed Dissolution & Re-integration"
    >
      {/* Edge Header Status Bar */}
      <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-slate-400">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isDisintegrated
                ? "bg-rose-500 animate-ping"
                : isReintegrating
                ? "bg-amber-400 animate-pulse"
                : "bg-sky-400"
            }`}
          />
          <span className="text-sky-300 font-bold uppercase">
            {phase === 0
              ? "WARSHIP: ASSEMBLED"
              : phase === 1
              ? "STATUS: DISINTEGRATING"
              : "STATUS: RE-INTEGRATING"}
          </span>
        </div>

        {/* Phase Indicator Bars */}
        <div className="flex items-center gap-1">
          <span className={`h-1 w-3 rounded-full transition-all ${phase === 0 ? "bg-sky-400" : "bg-slate-800"}`} />
          <span className={`h-1 w-3 rounded-full transition-all ${phase === 1 ? "bg-rose-500" : "bg-slate-800"}`} />
          <span className={`h-1 w-3 rounded-full transition-all ${phase === 2 ? "bg-amber-400" : "bg-slate-800"}`} />
        </div>
      </div>

      <svg
        className="w-full max-w-md h-36 mx-auto mt-2"
        viewBox="0 0 460 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="carrierGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="carrierHullGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#0f172a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ff2a55" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Radar Guideline */}
        <line x1="30" y1="70" x2="430" y2="70" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 3" />
        <circle cx="230" cy="70" r="45" stroke="#38bdf8" strokeWidth="0.6" opacity="0.2" strokeDasharray="2 4" />

        {/* Solid Warship Hull (Smoothly dissolves / solidifies) */}
        <g
          className="transition-all duration-1000 ease-in-out"
          style={{
            opacity: phase === 0 ? 1 : phase === 1 ? 0.08 : 0.65,
            transform: phase === 0
              ? "scale(1)"
              : phase === 1
              ? "scale(0.88) translateY(4px)"
              : "scale(0.96)",
            transformOrigin: "230px 70px",
          }}
          filter="url(#carrierGlow)"
        >
          {/* Main Hull Bow */}
          <polygon points="390,70 310,52 310,88" fill="url(#carrierHullGrad)" stroke="#38bdf8" strokeWidth="1.2" />

          {/* Central Warship Chassis */}
          <polygon points="310,52 190,40 110,58 110,82 190,100 310,88" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />

          {/* Command Tower Bridge */}
          <polygon points="230,40 260,26 280,40" fill="#38bdf8" opacity="0.8" />

          {/* Wings */}
          <polygon points="190,40 145,18 110,36" fill="#1e293b" stroke="#ff2a55" strokeWidth="1" />
          <polygon points="190,100 145,122 110,104" fill="#1e293b" stroke="#ff2a55" strokeWidth="1" />

          {/* Thruster Core */}
          <rect x="92" y="62" width="18" height="16" fill="#ff2a55" rx="2" className="animate-pulse" />
          <line x1="92" y1="70" x2="35" y2="70" stroke="#ff2a55" strokeWidth="1.5" strokeDasharray="4 3" />
        </g>

        {/* Quantum Disintegration Particles */}
        <g filter="url(#carrierGlow)">
          {hullParticles.map((p) => {
            const currentTranslate =
              phase === 0
                ? "translate(0px, 0px) scale(0)"
                : phase === 1
                ? `translate(${p.dx}px, ${p.dy}px) scale(1.6)`
                : `translate(${parseFloat(p.dx) * 0.3}px, ${parseFloat(p.dy) * 0.3}px) scale(0.9)`;

            const currentOpacity = phase === 0 ? 0 : phase === 1 ? 0.95 : 0.5;

            return (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r={p.size}
                fill={p.color}
                className="transition-all duration-1000 cubic-bezier(0.2, 0.8, 0.2, 1)"
                style={{
                  transform: currentTranslate,
                  opacity: currentOpacity,
                  transformOrigin: `${p.x}px ${p.y}px`,
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
