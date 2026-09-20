"use client";

import React from "react";

export default function CrimsonVeins() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-75">
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Moira Willix MTA Precision Gradient: Cyan to Crimson Arc */}
          <linearGradient id="mtaVeinGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#ff2a55" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="mtaVeinGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff2a55" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
          </linearGradient>

          {/* Electric Lightning Spark Glow Filter */}
          <filter id="lightningGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Subtle Rationalized Background Aura */}
        <circle cx="250" cy="180" r="280" fill="#38bdf8" opacity="0.04" filter="blur(100px)" />
        <circle cx="1150" cy="450" r="300" fill="#ff2a55" opacity="0.05" filter="blur(120px)" />

        {/* PRIMARY VASCULAR CONDUIT 1 - Upper Left to Mid Right */}
        <path
          d="M -50 120 C 220 80, 450 260, 720 180 T 1500 280"
          stroke="url(#mtaVeinGrad1)"
          strokeWidth="2"
        />
        {/* Lightning Arc Current 1 */}
        <path
          d="M -50 120 C 220 80, 450 260, 720 180 T 1500 280"
          stroke="#ff2a55"
          strokeWidth="2.5"
          filter="url(#lightningGlow)"
          className="animate-lightning"
        />
        {/* Fast Electric Spark Pulse */}
        <path
          d="M -50 120 C 220 80, 450 260, 720 180 T 1500 280"
          stroke="#38bdf8"
          strokeWidth="1.5"
          filter="url(#lightningGlow)"
          className="animate-spark-fast"
        />

        {/* PRIMARY VASCULAR CONDUIT 2 - Right to Lower Left */}
        <path
          d="M 1480 100 C 1200 320, 950 420, 680 520 S 200 680, -50 820"
          stroke="url(#mtaVeinGrad2)"
          strokeWidth="2"
        />
        {/* Lightning Arc Current 2 */}
        <path
          d="M 1480 100 C 1200 320, 950 420, 680 520 S 200 680, -50 820"
          stroke="#38bdf8"
          strokeWidth="2"
          filter="url(#lightningGlow)"
          className="animate-lightning"
          style={{ animationDelay: "1.2s" }}
        />

        {/* CAPILLARY LIGHTNING BRANCHES */}
        <path
          d="M 450 260 Q 520 400 480 580"
          stroke="#ff2a55"
          strokeWidth="1"
          strokeDasharray="4 6"
          opacity="0.4"
        />
        <path
          d="M 720 180 Q 820 350 950 420"
          stroke="#38bdf8"
          strokeWidth="1.2"
          strokeDasharray="6 4"
          opacity="0.5"
        />

        {/* MTA Precision Nodes (Glowing Electrical Discharges) */}
        <g filter="url(#lightningGlow)">
          <circle cx="450" cy="260" r="4" fill="#38bdf8" />
          <circle cx="450" cy="260" r="10" stroke="#38bdf8" strokeWidth="1" opacity="0.6" className="animate-ping" />

          <circle cx="720" cy="180" r="5" fill="#ff2a55" />
          <circle cx="720" cy="180" r="12" stroke="#ff2a55" strokeWidth="1" opacity="0.7" className="animate-ping" style={{ animationDuration: "2.5s" }} />

          <circle cx="950" cy="420" r="4" fill="#38bdf8" />
        </g>
      </svg>
    </div>
  );
}
