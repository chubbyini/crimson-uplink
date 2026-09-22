"use client";

import { useCallback, useEffect, useRef } from "react";

export interface MechTabArticle {
  id: string;
  title: string;
  status: string;
  words: number;
}

interface Props {
  articles: MechTabArticle[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const LAMP: Record<string, string> = {
  seed: "bg-slate-500",
  drafting: "bg-amber-400",
  ready: "bg-emerald-400",
  shipped: "bg-cyan-400",
};

/**
 * Carmine-mech article cycler: a ring strip where every option is visible,
 * the active plate is enlarged + lit, and selection wraps around.
 * Manual only: click a plate, use the chevrons, or arrow keys.
 */
export default function MechCycleTabs({ articles, activeId, onSelect, onNew }: Props) {
  const n = articles.length;
  const activeIdx = Math.max(0, articles.findIndex((a) => a.id === activeId));
  const trackRef = useRef<HTMLDivElement>(null);
  const plateRefs = useRef(new Map<string, HTMLButtonElement>());

  const select = useCallback(
    (idx: number) => {
      if (!n) return;
      const wrapped = ((idx % n) + n) % n;
      onSelect(articles[wrapped].id);
    },
    [n, articles, onSelect]
  );

  // Keep the active plate centered in the viewport.
  useEffect(() => {
    const el = plateRefs.current.get(activeId);
    const calm =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: calm ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [activeId, n]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      select(activeIdx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      select(activeIdx - 1);
    }
  };

  return (
    <div
      className="mech-cycler"
    >
      {n > 1 && (
        <button
          type="button"
          aria-label="Previous article"
          onClick={() => select(activeIdx - 1)}
          className="mech-chevron"
        >
          ‹
        </button>
      )}
      <div
        ref={trackRef}
        role="tablist"
        aria-label="Session articles"
        onKeyDown={onKey}
        className="mech-track mech-fade-x"
      >
        {articles.map((a, i) => {
          const isActive = a.id === activeId;
          return (
            <button
              key={a.id}
              ref={(el) => {
                if (el) plateRefs.current.set(a.id, el);
                else plateRefs.current.delete(a.id);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(i)}
              className={`mech-plate ${isActive ? "mech-plate-active" : ""}`}
            >
              <span className="mech-plate-top">
                <span className={`mech-lamp ${LAMP[a.status] ?? "bg-slate-500"}`} />
                <span className="mech-index">
                  {String(i + 1).padStart(2, "0")}/{String(n).padStart(2, "0")}
                </span>
              </span>
              <span className="mech-title">{a.title || "(untitled)"}</span>
              <span className="mech-sub">
                {a.status} · {a.words}w
              </span>
            </button>
          );
        })}
        <button type="button" onClick={onNew} aria-label="New article" className="mech-plate mech-forge">
          <span className="mech-forge-plus">+</span>
          <span className="mech-sub">forge new</span>
        </button>
      </div>
      {n > 1 && (
        <button
          type="button"
          aria-label="Next article"
          onClick={() => select(activeIdx + 1)}
          className="mech-chevron"
        >
          ›
        </button>
      )}
    </div>
  );
}
