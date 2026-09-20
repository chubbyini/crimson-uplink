"use client";

import React from "react";

export default function CarmineTitle() {
  return (
    <span className="relative inline-flex items-baseline tracking-tight font-black text-white">
      <span>CARMIN</span>

      {/* The Letter "E" with Crawling Lightning Tendrils */}
      <span className="relative inline-block text-white ml-0.5">
        <span>E</span>

        {/* SVG Lightning Crawling along the "E" */}
        <svg
          className="pointer-events-none absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] overflow-visible"
          viewBox="0 0 36 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="crawlingLightningGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur1" />
              <feGaussianBlur stdDeviation="3" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="crawlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#ff2a55" />
              <stop offset="85%" stopColor="#ff003c" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {/* Lightning 1: Crawling down the vertical spine and along top bar */}
          <path
            d="M 28 8 
               L 18 7 
               L 13 9 
               L 11 6 
               L 9 14 
               L 12 19 
               L 8 26 
               L 11 31 
               L 9 38 
               L 26 39"
            stroke="url(#crawlGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="bevel"
            filter="url(#crawlingLightningGlow)"
            className="animate-spark-fast"
          />

          {/* Lightning 2: Crawling along middle bar & leaping outward */}
          <path
            d="M 10 22 
               L 16 21 
               L 19 24 
               L 25 21 
               L 31 23 
               L 34 19"
            stroke="#ff003c"
            strokeWidth="1.4"
            strokeLinecap="round"
            filter="url(#crawlingLightningGlow)"
            className="animate-lightning"
            style={{ animationDelay: "0.4s" }}
          />

          {/* Branching Sparks leaping off the E's bottom tip */}
          <path
            d="M 26 39 L 31 37 L 35 42"
            stroke="#38bdf8"
            strokeWidth="1.2"
            strokeLinecap="round"
            filter="url(#crawlingLightningGlow)"
            className="animate-pulse"
          />

          {/* Tiny Arc Flash Beacons */}
          <circle cx="28" cy="8" r="1.8" fill="#ffffff" className="animate-ping" style={{ animationDuration: "1.5s" }} />
          <circle cx="34" cy="19" r="1.5" fill="#ff2a55" className="animate-ping" style={{ animationDuration: "2s" }} />
          <circle cx="35" cy="42" r="1.5" fill="#38bdf8" className="animate-ping" style={{ animationDuration: "1.2s" }} />
        </svg>
      </span>
    </span>
  );
}
