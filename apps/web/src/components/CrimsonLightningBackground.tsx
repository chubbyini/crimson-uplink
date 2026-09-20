"use client";

import React from "react";

export default function CrimsonLightningBackground() {
  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-20 overflow-hidden w-[380px] h-[380px] sm:w-[500px] sm:h-[500px] opacity-90">
      <svg
        className="w-full h-full"
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Intense Crimson Electrical Discharge Filters */}
          <filter id="jaggedGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur1" />
            <feGaussianBlur stdDeviation="7" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="boltGradCrimson" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#ff4d6d" />
            <stop offset="70%" stopColor="#ff003c" />
            <stop offset="100%" stopColor="#990015" />
          </linearGradient>

          <linearGradient id="forkGrad" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ff003c" />
            <stop offset="100%" stopColor="#ff758f" />
          </linearGradient>
        </defs>

        {/* Ambient Crimson Flash Radial Aura */}
        <circle cx="380" cy="380" r="140" fill="#ff003c" opacity="0.08" filter="blur(60px)" />

        {/* PRIMARY JAGGED LIGHTNING STRIKE 1 (Main Trunk & Multiple Forks) */}
        <g filter="url(#jaggedGlow)" className="animate-jagged-bolt-1">
          {/* Main Jagged Trunk (From bottom-right ground striking inward/upward) */}
          <path
            d="M 480 490 
               L 425 410 
               L 440 395 
               L 380 320 
               L 400 305 
               L 320 220 
               L 340 205 
               L 260 130 
               L 275 118 
               L 210 50 
               L 220 38 
               L 165 5"
            stroke="url(#boltGradCrimson)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="miter"
          />

          {/* Major Fork 1 - Branching to left */}
          <path
            d="M 380 320 
               L 315 345 
               L 285 330 
               L 220 375 
               L 190 365 
               L 140 405"
            stroke="url(#forkGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="miter"
          />

          {/* Sub-branch off Fork 1 */}
          <path
            d="M 285 330 L 260 295 L 220 305 L 185 280"
            stroke="#ff2a55"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Major Fork 2 - Branching upward/mid */}
          <path
            d="M 320 220 
               L 255 235 
               L 230 215 
               L 170 240 
               L 145 225 
               L 95 255"
            stroke="url(#forkGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Major Fork 3 - High elevation crackle */}
          <path
            d="M 260 130 
               L 215 145 
               L 190 135 
               L 140 160 
               L 120 150 
               L 70 175"
            stroke="#ff4d6d"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Fine Needle Tendrils */}
          <path
            d="M 425 410 L 460 375 L 445 350"
            stroke="#ff758f"
            strokeWidth="1"
          />
          <path
            d="M 210 50 L 175 65 L 155 55 L 120 80"
            stroke="#ff758f"
            strokeWidth="1"
          />
        </g>

        {/* SECONDARY JAGGED LIGHTNING STRIKE 2 (Offset Crackle for Depth) */}
        <g filter="url(#jaggedGlow)" className="animate-jagged-bolt-2">
          <path
            d="M 495 440 
               L 440 370 
               L 455 355 
               L 395 285 
               L 410 270 
               L 350 195 
               L 320 210 
               L 270 160 
               L 285 148 
               L 235 90"
            stroke="#ff003c"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="miter"
          />

          <path
            d="M 395 285 L 340 310 L 315 295 L 260 330"
            stroke="#ff4d6d"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
