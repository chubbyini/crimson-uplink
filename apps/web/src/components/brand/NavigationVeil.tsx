"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SojournerLoader } from "./SojournerLoader";

const MIN_SHOW_MS = 600;
const SAFETY_MS = 5000;

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

  return (
    <VeilCtx.Provider value={{ show }}>
      {children}
      {visible && <SojournerLoader />}
    </VeilCtx.Provider>
  );
}
