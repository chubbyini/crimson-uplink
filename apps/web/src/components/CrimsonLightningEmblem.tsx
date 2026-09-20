"use client";

import React, { useState } from "react";

export default function CrimsonLightningEmblem() {
  const [active, setActive] = useState(false);

  return (
    <div
      onClick={() => setActive(!active)}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center cursor-pointer group"
      title="Crimson Lightning Uplink Node"
    >
      {/* Outer Crimson Pulse Rings */}
      <div className="absolute h-14 w-14 rounded-full border border-rose-500/40 opacity-75 animate-ping" />
      <div className="absolute h-16 w-16 rounded-full border border-rose-600/20" />

      {/* Main Crimson Node Container */}
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/60 bg-slate-950/90 shadow-[0_0_20px_rgba(255,42,85,0.4)] backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:border-rose-400 group-hover:shadow-[0_0_30px_rgba(255,42,85,0.7)]">
        <svg
          className="h-7 w-7 transition-transform group-hover:scale-110"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="crimsonBoltGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4d6d" />
              <stop offset="60%" stopColor="#ff003c" />
              <stop offset="100%" stopColor="#990015" />
            </linearGradient>
          </defs>

          {/* Background Electric Discharge Tendrils */}
          <path
            d="M6 12L3 14M18 12L21 10M12 3L10 1M12 21L14 23"
            stroke="#ff2a55"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.6"
            className="animate-pulse"
          />

          {/* Main Crimson Lightning Bolt */}
          <path
            d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z"
            fill="url(#boltGrad)"
            stroke="#ff4d6d"
            strokeWidth="1"
            strokeLinejoin="round"
            filter="url(#crimsonBoltGlow)"
            className={active ? "animate-bounce" : ""}
          />
        </svg>

        {/* Mini Energy Indicator Dot */}
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 border border-slate-950 shadow-[0_0_8px_#ff003c] animate-pulse" />
      </div>
    </div>
  );
}
