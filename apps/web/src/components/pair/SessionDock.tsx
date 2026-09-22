"use client";

import { useEffect, useRef, useState } from "react";

export interface DockSession {
  id: string;
  title: string;
  mode: string;
  phase: string;
  status: string;
  updatedAt: string;
  articleCount: number;
}

interface Props {
  sessions: DockSession[];
  hasMore: boolean;
  loadingMore: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onLoadMore: () => void;
}

const CARD_W = 232;
const GAP = 12;
const STRIDE = CARD_W + GAP;
const OVERSCAN = 4;

/**
 * Bottom-docked session rail: holds ALL user sessions via infinite scroll
 * (paginated fetch) + horizontal virtualization (only the visible window
 * of fixed-stride cards is mounted, flanked by spacers).
 */
export default function SessionDock({
  sessions,
  hasMore,
  loadingMore,
  activeId,
  onOpen,
  onNew,
  onLoadMore,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [range, setRange] = useState({ start: 0, end: 12 });
  const raf = useRef(0);

  const measure = () => {
    const el = trackRef.current;
    if (!el) return;
    const visible = Math.ceil(el.clientWidth / STRIDE) + OVERSCAN * 2;
    const start = Math.max(0, Math.floor(el.scrollLeft / STRIDE) - OVERSCAN);
    setRange({ start, end: Math.min(sessions.length, start + visible) });
    // Infinite scroll: prefetch before hitting the end.
    if (hasMore && !loadingMore && el.scrollLeft + el.clientWidth > el.scrollWidth - STRIDE * 3) {
      onLoadMore();
    }
  };

  useEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length, hasMore, loadingMore]);

  // Keep the active session card in view on selection.
  useEffect(() => {
    if (!activeId) return;
    cardRefs.current.get(activeId)?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeId]);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(measure);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const { start, end } = range;
  const leftPad = start * STRIDE;
  const rightPad = Math.max(0, (sessions.length - end) * STRIDE - GAP);
  const visible = sessions.slice(start, end);

  return (
    <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl lg:left-60">
      <div className="mx-auto flex w-full max-w-6xl items-stretch gap-3 px-6 py-3">
        <div className="flex flex-col justify-center">
          <span className="font-mono text-[10px] tracking-widest text-slate-500">SESSIONS</span>
          <span className="font-mono text-[10px] text-slate-600">{sessions.length}{hasMore ? "+" : ""}</span>
          <button onClick={onNew} className="btn-primary-sm mt-1 whitespace-nowrap">
            + New
          </button>
        </div>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex min-w-0 flex-1 items-stretch gap-3 overflow-x-auto py-1"
        >
          {leftPad > 0 && <div style={{ flex: `0 0 ${leftPad}px` }} aria-hidden />}
          {visible.map((s) => (
            <button
              key={s.id}
              ref={(el) => {
                if (el) cardRefs.current.set(s.id, el);
                else cardRefs.current.delete(s.id);
              }}
              onClick={() => onOpen(s.id)}
              style={{ flex: `0 0 ${CARD_W}px` }}
              aria-current={s.id === activeId ? "true" : undefined}
              className={`rounded-xl border p-3 text-left transition-colors ${
                s.id === activeId
                  ? "border-red-600 bg-red-950/40"
                  : "border-slate-800 bg-white/[0.02] hover:bg-white/5"
              }`}
            >
              <span className="block truncate text-sm text-slate-200">{s.title}</span>
              <span className="mt-1 block font-mono text-[10px] text-slate-500">
                {s.mode} · {s.phase} · {s.articleCount}a · {s.status}
              </span>
            </button>
          ))}
          {rightPad > 0 && <div style={{ flex: `0 0 ${rightPad}px` }} aria-hidden />}
          {loadingMore && (
            <div className="flex flex-none items-center px-2 font-mono text-[11px] text-slate-500">
              loading…
            </div>
          )}
          {!hasMore && sessions.length === 0 && !loadingMore && (
            <div className="flex flex-none items-center px-2 text-xs text-slate-500">
              No sessions yet — start one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
