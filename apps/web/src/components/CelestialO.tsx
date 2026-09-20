"use client";

import React from "react";

export default function CelestialO() {
  return (
    <span className="relative inline-flex items-center justify-center align-baseline mx-0.5 w-[0.8em] h-[0.8em]">
      {/* The Letter "O" Outer Orbital Portal Ring */}
      <svg
        className="w-full h-full overflow-visible"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Globe Spherical Shading Gradient */}
          <radialGradient id="globeSphereGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#38bdf8" />
            <stop offset="65%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>

          {/* Mini Planet 2 Gradient */}
          <radialGradient id="planet2Grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff758f" />
            <stop offset="50%" stopColor="#ff003c" />
            <stop offset="100%" stopColor="#4c0519" />
          </radialGradient>

          {/* Glow filter for celestial core */}
          <filter id="celestialGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="coronaGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        {/* Back-Half Orbital Ring Track (Behind Globe) */}
        <ellipse
          cx="50"
          cy="50"
          rx="44"
          ry="15"
          transform="rotate(-25 50 50)"
          stroke="#38bdf8"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.4"
        />

        {/* Secondary Cross-Orbit Track (Tilted Opposite) */}
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="11"
          transform="rotate(35 50 50)"
          stroke="#ff2a55"
          strokeWidth="0.8"
          strokeDasharray="3 3"
          opacity="0.3"
        />

        {/* The Outer "O" Aperture Structure */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle
          cx="50"
          cy="50"
          r="47"
          stroke="#38bdf8"
          strokeWidth="1.2"
          strokeDasharray="6 8"
          className="animate-spin"
          style={{ animationDuration: "16s" }}
        />

        {/* Ambient Corona of the Central Globe */}
        <circle
          cx="50"
          cy="50"
          r="22"
          fill="#38bdf8"
          opacity="0.25"
          filter="url(#coronaGlow)"
        />

        {/* CENTRAL GLOBE (Mini Planetary Core with Latitude Rings) */}
        <g filter="url(#celestialGlow)">
          <circle
            cx="50"
            cy="50"
            r="16"
            fill="url(#globeSphereGrad)"
            stroke="#e0f2fe"
            strokeWidth="0.6"
          />

          {/* Globe Atmosphere Latitude / Longitude lines */}
          <ellipse cx="50" cy="50" rx="16" ry="6" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
          <ellipse cx="50" cy="50" rx="7" ry="16" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.3" />
        </g>

        {/* ORBITING SATELLITE 1: Enters and Exits the "O" (3D Depth Loop) */}
        {/* We animate this group with CSS along the tilted elliptical path */}
        <g className="animate-pulse">
          {/* Front arc of the main orbital track */}
          <path
            d="M 12 65 A 44 15 0 0 0 88 35"
            transform="rotate(-25 50 50)"
            stroke="#38bdf8"
            strokeWidth="1.2"
            opacity="0.7"
          />
        </g>

        {/* Planet 1: Orbiting in & out (Animated via SVG keyframe / transform) */}
        <g>
          <circle
            cx="50"
            cy="50"
            r="4.5"
            fill="url(#planet2Grad)"
            stroke="#ffffff"
            strokeWidth="0.5"
            filter="url(#celestialGlow)"
          >
            {/* Native SVG animateTransform to plunge in and out through the O's depth */}
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-32,-15; 0,0; 32,15; 0,-15; -32,-15"
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              dur="4s"
              repeatCount="indefinite"
            />
            {/* Scale pulse for 3D depth (closer = bigger, farther = smaller) */}
            <animate
              attributeName="r"
              values="5.5; 3.5; 2.2; 3.5; 5.5"
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              dur="4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1; 0.7; 0.35; 0.7; 1"
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Planet 2: Second celestial moon orbiting on cross angle */}
        <g>
          <circle
            cx="50"
            cy="50"
            r="2.8"
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth="0.4"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="25,-18; 0,8; -25,18; 0,-8; 25,-18"
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              dur="3.2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="3.2; 1.8; 1.2; 2.2; 3.2"
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>
    </span>
  );
}
