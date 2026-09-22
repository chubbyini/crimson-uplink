"use client";

import { useEffect, useState } from "react";
import { SojournerToken, type SojournerVariant } from "./tokens";

const LINES = [
  "Seeking knowledge…",
  "Moving forward…",
  "Knowledge never ends…",
];

/**
 * Full-veil token loader. Import anywhere:
 *   import { SojournerLoader } from "@/components/brand/SojournerLoader";
 */
export function SojournerLoader({ label, variant = "waymark" }: { label?: string; variant?: SojournerVariant }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((n) => (n + 1) % LINES.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? LINES[line]}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-[#05070d]/95 backdrop-blur-sm"
    >
      <SojournerToken size={128} variant={variant} />
      <div className="text-center">
        <p className="font-mono text-sm font-bold tracking-[0.3em] text-slate-100">
          SOJOURNER <span className="text-[#ff2a55]">BUILDS</span>
        </p>
        <p className="mt-2 font-mono text-xs text-slate-400">{label ?? LINES[line]}</p>
      </div>
    </div>
  );
}
