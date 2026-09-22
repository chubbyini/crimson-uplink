"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SojournerLoader } from "./SojournerLoader";
import type { SojournerVariant } from "./tokens";

const MIN_SHOW_MS = 600;
const SAFETY_MS = 5000;
/** Local pick from /logo (dev preview). Tell the builder the winner to hardwire it. */
export const SOJOURNER_PICK_KEY = "sj-logo-pick";
export const PICK_EVENT = "sj-logo-pick-changed";

function readPick(): SojournerVariant {
  try {
    const v = localStorage.getItem(SOJOURNER_PICK_KEY);
    return v === "monogram" || v === "compass" ? v : "waymark";
  } catch {
    return "waymark";
  }
}

const VeilCtx = createContext<{ show: () => void }>({ show: () => {} });

/** Call inside any component under the provider to flash the token veil. */
export function useSojournerVeil() {
  return useContext(VeilCtx);
}

/**
 * Mount once in layout around nav + content. show() displays the token
 * immediately; it hides on pathname change (min 600ms showcase) with a 5s
 * safety cap so it can never stick.
 */
export function SojournerVeilProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<SojournerVariant>(readPick);
  const shownAt = useRef(0);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    shownAt.current = Date.now();
    setVisible(true);
    if (safety.current) clearTimeout(safety.current);
    safety.current = setTimeout(() => setVisible(false), SAFETY_MS);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt.current));
    const t = setTimeout(() => setVisible(false), wait);
    return () => clearTimeout(t);
  }, [pathname, visible]);

  useEffect(
    () => () => {
      if (safety.current) clearTimeout(safety.current);
    },
    []
  );

  // Live-preview the /logo pick (same tab via event, other tabs via storage).
  useEffect(() => {
    const onChange = () => setVariant(readPick());
    window.addEventListener(PICK_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PICK_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return (
    <VeilCtx.Provider value={{ show }}>
      {children}
      {visible && <SojournerLoader variant={variant} />}
    </VeilCtx.Provider>
  );
}
