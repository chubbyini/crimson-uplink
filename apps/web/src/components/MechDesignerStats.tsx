"use client";

import React from "react";

const stats = [
  {
    metric: "500+",
    label: "DAILY SOURCES SCANNED",
    sub: "RSS, Bluesky, Mastodon, HackerNews, GitHub, npm",
    icon: (
      <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    metric: "1.8s",
    label: "DUAL-BRAIN LATENCY",
    sub: "Gemini 2.0 (Structure) + Groq Llama 3.3 (Voice)",
    icon: (
      <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    metric: "100%",
    label: "TELEGRAM GOVERNANCE",
    sub: "Human-in-the-loop review via inline phone gate",
    icon: (
      <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    metric: "BYOK",
    label: "ENCRYPTED PRIVACY",
    sub: "Per-user isolated Firestore security rules",
    icon: (
      <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

export default function MechDesignerStats() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((item, idx) => (
        <div
          key={idx}
          className="mta-card flex flex-col justify-between rounded-xl p-5 transition-all hover:border-sky-400/50 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900">
              {item.icon}
            </div>
            <span className="font-mono text-2xl font-bold text-white">
              {item.metric}
            </span>
          </div>

          <div className="mt-4">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
              {item.label}
            </p>
            <p className="mt-1 text-xs text-slate-400 leading-normal">
              {item.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
