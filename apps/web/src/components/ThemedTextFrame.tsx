"use client";

import React from "react";

export default function ThemedTextFrame({ text }: { text: string }) {
  return (
    <span className="relative inline-block my-1 px-4 py-1 sm:px-6 sm:py-2">
      {/* Surrounding Themed SVG Matrix */}
      <svg
        className="pointer-events-none absolute inset-0 -m-1 h-[calc(100%+8px)] w-[calc(100%+8px)] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="frameGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="frameLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#ff2a55" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        {/* Animated Horizontal Bounding Traces (Top & Bottom) */}
        <line
          x1="20"
          y1="2"
          x2="95%"
          y2="2"
          stroke="url(#frameLineGrad)"
          strokeWidth="1.2"
          strokeDasharray="6 8"
          className="animate-spark-fast"
          filter="url(#frameGlow)"
        />
        <line
          x1="5%"
          y1="98%"
          x2="85%"
          y2="98%"
          stroke="url(#frameLineGrad)"
          strokeWidth="1.2"
          strokeDasharray="8 6"
          className="animate-spark-fast"
          style={{ animationDirection: "reverse" }}
          filter="url(#frameGlow)"
        />

        {/* Tactical Corner Reticle Brackets (L-shapes) */}
        {/* Top-Left Corner (Cyan) */}
        <g filter="url(#frameGlow)">
          <path
            d="M 0 16 L 0 0 L 22 0"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="square"
          />
          <circle cx="0" cy="0" r="2.5" fill="#38bdf8" className="animate-pulse" />
        </g>

        {/* Top-Right Corner (Crimson) */}
        <g filter="url(#frameGlow)">
          <path
            d="M calc(100% - 22px) 0 L 100% 0 L 100% 16"
            stroke="#ff2a55"
            strokeWidth="2"
            strokeLinecap="square"
          />
          <circle cx="100%" cy="0" r="2.5" fill="#ff2a55" className="animate-pulse" />
        </g>

        {/* Bottom-Left Corner (Crimson) */}
        <g filter="url(#frameGlow)">
          <path
            d="M 0 calc(100% - 16px) L 0 100% L 22 100%"
            stroke="#ff2a55"
            strokeWidth="2"
            strokeLinecap="square"
          />
          <circle cx="0" cy="100%" r="2.5" fill="#ff2a55" className="animate-pulse" />
        </g>

        {/* Bottom-Right Corner (Cyan) */}
        <g filter="url(#frameGlow)">
          <path
            d="M calc(100% - 22px) 100% L 100% 100% L 100% calc(100% - 16px)"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="square"
          />
          <circle cx="100%" cy="100%" r="2.5" fill="#38bdf8" className="animate-pulse" />
        </g>

        {/* Micro-Crosshair Center Flanks */}
        <g opacity="0.6">
          {/* Left Flank Crosshair */}
          <line x1="-8" y1="50%" x2="-2" y2="50%" stroke="#38bdf8" strokeWidth="1.2" />
          <line x1="-5" y1="calc(50% - 3px)" x2="-5" y2="calc(50% + 3px)" stroke="#38bdf8" strokeWidth="1.2" />

          {/* Right Flank Crosshair */}
          <line x1="calc(100% + 2px)" y1="50%" x2="calc(100% + 8px)" y2="50%" stroke="#ff2a55" strokeWidth="1.2" />
          <line x1="calc(100% + 5px)" y1="calc(50% - 3px)" x2="calc(100% + 5px)" y2="calc(50% + 3px)" stroke="#ff2a55" strokeWidth="1.2" />
        </g>
      </svg>

      {/* Solid Non-Gradient Text */}
      <span className="relative z-10 font-black tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
        {text}
      </span>
    </span>
  );
}
