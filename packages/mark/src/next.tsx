"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SojournerLoader } from "./loader";
import type { SojournerVariant } from "./tokens";

/**
 * @sojournerbuilds/mark/next — Next.js route veil. Requires `next`.
 *
 * Mount once in your root layout:
 *   import { SojournerVeilProvider } from "@sojournerbuilds/mark/next";
 *
 * Three coverage modes share one pending-counter; the veil lifts when the
 * last hold clears (allSettled semantics — rejections never stick it):
 * - route flashes: show() on navigation, auto-cleared on pathname change
 * - client fetches: veil.track(promise) / veil.trackAll([...])
 * - slow server pages: drop <SojournerRelease /> last in the page
 */

/** Local pick override (dev preview). UIs can write this key to switch marks. */
export const SOJOURNER_PICK_KEY = "sj-logo-pick";
export const PICK_EVENT = "sj-logo-pick-changed";
/** Opt individual links out of navigation coverage: <Link data-sj-noveil …>. */
export const NOVEIL_ATTR = "data-sj-noveil";

const MIN_SHOW_MS = 600;
const FLASH_SAFETY_MS = 5000;

type HoldKind = "flash" | "track" | "settle";

export interface SojournerVeil {
  /** Flash the veil. Returns a release fn; also auto-cleared on pathname change. */
  show: () => () => void;
  /** Cover one promise. Veil lifts when it settles (fulfilled OR rejected). */
  track: <T>(promise: Promise<T>) => Promise<T>;
  /** Cover many promises. Veil lifts when ALL settle. */
  trackAll: (promises: Array<Promise<unknown>>) => Promise<void>;
}

interface VeilCtx extends SojournerVeil {
  /** Called by <SojournerRelease /> when streamed content arrives. */
  settled: () => void;
}

function readPick(): SojournerVariant {
  try {
    const v = localStorage.getItem(SOJOURNER_PICK_KEY);
    return v === "monogram" || v === "compass" ? v : "waymark";
  } catch {
    return "waymark";
  }
}

const Ctx = createContext<VeilCtx>({
  show: () => () => {},
  track: (p) => p,
  trackAll: () => Promise.resolve(),
  settled: () => {},
});

/** Call inside any component under the provider for manual/track coverage. */
export function useSojournerVeil(): SojournerVeil {
  return useContext(Ctx);
}

/**
 * Drop as the LAST element of a slow server page. When it streams in and
 * hydrates, any pending navigation coverage ends — so the veil spans the
 * full server await. No-op on pages the veil isn't covering.
 */
export function SojournerRelease() {
  const { settled } = useContext(Ctx);
  useEffect(() => {
    settled();
  }, [settled]);
  return null;
}

export interface SojournerVeilProviderProps {
  children: React.ReactNode;
  /** Hardwire a variant instead of reading the local pick. */
  variant?: SojournerVariant;
  /** Cover same-origin link clicks automatically. Default true. */
  coverNavigations?: boolean;
  /** Cap for tracked-fetch holds. Default 30000. Hung requests can't stick the veil. */
  trackTimeoutMs?: number;
  /** Bridge window after pathname change for <SojournerRelease /> to land. Default 900. */
  settleMs?: number;
  /** Loading line under the mark while covered. */
  label?: string;
}

export function SojournerVeilProvider({
  children,
  variant,
  coverNavigations = true,
  trackTimeoutMs = 30000,
  settleMs = 900,
  label,
}: SojournerVeilProviderProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [liveVariant, setLiveVariant] = useState<SojournerVariant>(variant ?? readPick);
  const holds = useRef(new Map<number, { kind: HoldKind; timer: ReturnType<typeof setTimeout> }>());
  const nextId = useRef(1);
  const shownAt = useRef(0);
  const tracked = useRef(new Set<Promise<unknown>>());

  const evaluate = useCallback(() => {
    if (holds.current.size > 0) return;
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt.current));
    window.setTimeout(() => {
      if (holds.current.size === 0) setVisible(false);
    }, wait);
  }, []);

  const release = useCallback(
    (id: number) => {
      const hold = holds.current.get(id);
      if (!hold) return;
      clearTimeout(hold.timer);
      holds.current.delete(id);
      evaluate();
    },
    [evaluate]
  );

  const acquire = useCallback(
    (kind: HoldKind, safetyMs: number) => {
      if (holds.current.size === 0) shownAt.current = Date.now();
      setVisible(true);
      const id = nextId.current++;
      holds.current.set(id, {
        kind,
        timer: setTimeout(() => release(id), safetyMs),
      });
      return () => release(id);
    },
    [release]
  );

  const show = useCallback(() => acquire("flash", FLASH_SAFETY_MS), [acquire]);

  const track = useCallback(
    <T,>(promise: Promise<T>): Promise<T> => {
      if (!tracked.current.has(promise)) {
        tracked.current.add(promise);
        const done = acquire("track", trackTimeoutMs);
        const cleanup = () => {
          tracked.current.delete(promise);
          done();
        };
        void promise.then(cleanup, cleanup);
      }
      return promise;
    },
    [acquire, trackTimeoutMs]
  );

  const trackAll = useCallback(
    (promises: Array<Promise<unknown>>) =>
      track(Promise.allSettled(promises).then(() => undefined)),
    [track]
  );

  const settled = useCallback(() => {
    let cleared = false;
    for (const [id, hold] of holds.current) {
      if (hold.kind === "settle") {
        clearTimeout(hold.timer);
        holds.current.delete(id);
        cleared = true;
      }
    }
    if (cleared) evaluate();
  }, [evaluate]);

  // Previous page's holds are stale — clear them, then bridge streaming so
  // <SojournerRelease /> has a window to land. Skipped when idle.
  useEffect(() => {
    if (holds.current.size === 0) return;
    for (const [, hold] of holds.current) clearTimeout(hold.timer);
    holds.current.clear();
    acquire("settle", settleMs);
  }, [pathname, acquire, settleMs]);

  // Same-origin link clicks start coverage for the outgoing page.
  useEffect(() => {
    if (!coverNavigations) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!el) return;
      if (el.hasAttribute(NOVEIL_ATTR)) return;
      if (el.hasAttribute("download")) return;
      const target = el.getAttribute("target");
      if (target && target !== "_self") return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      try {
        const url = new URL((el as HTMLAnchorElement).href, window.location.href);
        if (url.origin !== window.location.origin) return;
      } catch {
        return;
      }
      show();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [coverNavigations, show]);

  // Live-preview a picked variant (dev rooms writing SOJOURNER_PICK_KEY).
  useEffect(() => {
    if (variant) {
      setLiveVariant(variant);
      return;
    }
    const onChange = () => setLiveVariant(readPick());
    window.addEventListener(PICK_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PICK_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [variant]);

  // Never leak timers on unmount.
  useEffect(
    () => () => {
      for (const [, hold] of holds.current) clearTimeout(hold.timer);
      holds.current.clear();
    },
    []
  );

  const value = { show, track, trackAll, settled };
  return (
    <Ctx.Provider value={value}>
      {children}
      {visible && <SojournerLoader variant={liveVariant} label={label} />}
    </Ctx.Provider>
  );
}
