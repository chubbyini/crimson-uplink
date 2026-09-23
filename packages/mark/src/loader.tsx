"use client";

import { useEffect, useState } from "react";
import { SojournerToken, type SojournerVariant } from "./tokens";

const LINES = [
  "Seeking knowledge…",
  "Moving forward…",
  "Knowledge never ends…",
];

/**
 * Full-veil token loader. Pair with veil.css:
 *   import "@sojournerbuilds/mark/veil.css";
 *   import { SojournerLoader } from "@sojournerbuilds/mark/loader";
 */
export function SojournerLoader({ label, variant = "waymark" }: { label?: string; variant?: SojournerVariant }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((n) => (n + 1) % LINES.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" aria-label={label ?? LINES[line]} className="sj-veil">
      {/* Veil backdrop is always dark — lock the token palette to match. */}
      <SojournerToken size={256} variant={variant} theme="dark" />
      <div className="sj-veil-title">
        <p>
          SOJOURNER <span className="sj-veil-accent">BUILDS</span>
        </p>
        <p className="sj-veil-sub">{label ?? LINES[line]}</p>
      </div>
    </div>
  );
}
