"use client";

import Link from "next/link";
import { useState } from "react";
import { SojournerToken } from "@/components/brand/tokens";

const IMPORT_SNIPPET = `import { SojournerToken } from "@/components/brand/tokens";
import { SojournerLoader } from "@/components/brand/SojournerLoader";

// Inline mark (tab spinner, empty state, button)
<SojournerToken size={48} />

// Full veil (route transitions, AI-pending screens)
{busy && <SojournerLoader label="Drafting with Groq…" />}`;

/** Public showcase for the Sojourner Builds waymark. No auth required. */
export default function TokenPage() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(IMPORT_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — snippet is selectable below.
    }
  }
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <SojournerToken size={200} />
        <h1 className="ui-title mt-6">
          SOJOURNER <span className="text-[#ff2a55]">BUILDS</span>
        </h1>
        <p className="ui-sub max-w-xl">
          Always seeking knowledge. Always moving forward. Knowledge never ends —
          so the traveller keeps going: Lagos → Kaduna → Cross River, and beyond.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <div className="ui-panel p-5">
          <h2 className="text-sm font-semibold text-slate-200">The S — always seeking</h2>
          <p className="mt-2 text-sm text-slate-400">
            An angular S for the promise: never stop seeking knowledge. It breathes
            slowly while the dial spins around it.
          </p>
        </div>
        <div className="ui-panel p-5">
          <h2 className="text-sm font-semibold text-slate-200">The path — always moving</h2>
          <p className="mt-2 text-sm text-slate-400">
            A kinked momentum bolt cuts through the mark and points onward. You go
            around, you move, you gather.
          </p>
        </div>
        <div className="ui-panel p-5">
          <h2 className="text-sm font-semibold text-slate-200">Three waypoints</h2>
          <p className="mt-2 text-sm text-slate-400">
            Three stations light in sequence on every revolution — Lagos, Kaduna,
            Cross River. The spin is the journey; lit waypoints are knowledge kept.
          </p>
        </div>
      </div>

      <div className="ui-panel mt-6 flex flex-wrap items-end justify-center gap-8 p-6">
        {[
          { size: 32, label: "tab / favicon" },
          { size: 64, label: "inline / button" },
          { size: 128, label: "veil / hero" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-2">
            <SojournerToken size={s.size} />
            <span className="font-mono text-[11px] text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="ui-panel mt-6 p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Import anywhere</h2>
          <button onClick={copy} className="btn-ghost ml-auto">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-xs text-slate-300">
          {IMPORT_SNIPPET}
        </pre>
        <p className="mt-3 text-xs text-slate-500">
          Props: <span className="font-mono">size · spinning · speed (slow|normal|fast) · ring (ticks|solid|none) · waypoints · glow</span>.
          Respects <span className="font-mono">prefers-reduced-motion</span>. Zero dependencies.
        </p>
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Building something? <Link href="/" className="text-sky-300 underline">Back to the console</Link>
      </p>
    </main>
  );
}
