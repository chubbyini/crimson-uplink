"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import {
  PORTABLE_CSS,
  SojournerToken,
  type SojournerRing,
  type SojournerSpeed,
} from "@/components/brand/tokens";

const NOTES_KEY = "sj-logo-notes";

/** TEMP-DEV: iterate on the Waymark until it's the one, then export it. */
export default function LogoRoom() {
  const toast = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState<SojournerSpeed>("normal");
  const [ring, setRing] = useState<SojournerRing>("ticks");
  const [waypoints, setWaypoints] = useState(true);
  const [glow, setGlow] = useState(true);
  const [spinning, setSpinning] = useState(true);
  const [size, setSize] = useState(220);
  const [notes, setNotes] = useState(() => {
    try {
      return localStorage.getItem(NOTES_KEY) ?? "";
    } catch {
      // SSR or private mode — starts empty, persists when possible.
      return "";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, notes);
    } catch {
      // Best-effort persistence.
    }
  }, [notes]);

  async function copyText(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      toast.error("Clipboard blocked — select the text manually");
    }
  }

  function copyBrief() {
    const brief = [
      `# Waymark modification brief (${new Date().toISOString().slice(0, 10)})`,
      ``,
      `Settings: speed=${speed} ring=${ring} waypoints=${waypoints ? "on" : "off"} glow=${glow ? "on" : "off"} spinning=${spinning ? "on" : "off"} size=${size}`,
      ``,
      `## Notes`,
      notes.trim() || "(no notes yet)",
      ``,
      `Apply to apps/web/src/components/brand/tokens.tsx and confirm in /logo.`,
    ].join("\n");
    void copyText(brief, "Brief copied — paste it back in chat");
  }

  function copyPortable() {
    const svg = previewRef.current?.querySelector("svg")?.outerHTML;
    if (!svg) {
      toast.error("Render the preview first");
      return;
    }
    void copyText(
      `<!-- Sojourner Builds waymark — portable: paste anywhere -->\n<style>\n${PORTABLE_CSS}\n</style>\n${svg}`,
      "Portable token copied ✓"
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="font-mono text-[11px] tracking-widest text-amber-400">TEMP DEV ROOM — NOT LINKED, 404 IN PROD</p>
      <h1 className="ui-title mt-1">Waymark perfect-it room</h1>
      <p className="ui-sub">Tweak live, note what&apos;s off, copy the brief back to chat. Export when it&apos;s the one.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="ui-panel flex flex-col items-center p-8">
          <div ref={previewRef}>
            <SojournerToken
              size={size}
              spinning={spinning}
              speed={speed}
              ring={ring}
              waypoints={waypoints}
              glow={glow}
            />
          </div>
          <p className="mt-4 font-mono text-[11px] text-slate-500">
            {size}px · {speed} · {ring} · wp {waypoints ? "on" : "off"} · glow {glow ? "on" : "off"}
          </p>
          <label className="mt-4 flex w-full items-center gap-3 text-xs text-slate-400">
            Size
            <input
              type="range"
              min={64}
              max={320}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono">{size}</span>
          </label>
        </div>

        <div className="flex flex-col gap-4">
          <div className="ui-panel p-5">
            <h2 className="text-sm font-semibold">Toggles (live)</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["slow", "normal", "fast"] as const).map((s) => (
                <button key={s} onClick={() => setSpeed(s)} className={speed === s ? "chip-active" : "chip"}>{s}</button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["ticks", "solid", "none"] as const).map((r) => (
                <button key={r} onClick={() => setRing(r)} className={ring === r ? "chip-active" : "chip"}>ring: {r}</button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => setWaypoints((v) => !v)} className={waypoints ? "chip-active" : "chip"}>
                waypoints {waypoints ? "on" : "off"}
              </button>
              <button onClick={() => setGlow((v) => !v)} className={glow ? "chip-active" : "chip"}>
                glow {glow ? "on" : "off"}
              </button>
              <button onClick={() => setSpinning((v) => !v)} className={spinning ? "chip-active" : "chip"}>
                spin {spinning ? "on" : "off"}
              </button>
            </div>
          </div>

          <div className="ui-panel p-5">
            <h2 className="text-sm font-semibold">Modification notes (autosaved)</h2>
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. thicker S, slower spin, dimmer glow, cyan path too bright…"
              className="input mt-3"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={copyBrief} className="btn-primary-sm">Copy brief for chat</button>
              <button onClick={copyPortable} className="btn-ghost">Copy portable token</button>
              <Link href="/token" className="btn-ghost">View /token</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
