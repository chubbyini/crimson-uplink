"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { PICK_EVENT, SOJOURNER_PICK_KEY } from "@/components/brand/NavigationVeil";
import {
  PORTABLE_CSS,
  SOJOURNER_VARIANTS,
  SojournerToken,
  type SojournerRing,
  type SojournerSpeed,
  type SojournerVariant,
} from "@/components/brand/tokens";

const NOTES_KEY = "sj-logo-notes";

function readPick(): SojournerVariant {
  try {
    const v = localStorage.getItem(SOJOURNER_PICK_KEY);
    return v === "monogram" || v === "compass" ? v : "waymark";
  } catch {
    return "waymark";
  }
}

/** TEMP-DEV: step through all 3, pick one, perfect it, export it. */
export default function LogoRoom() {
  const toast = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<SojournerVariant>(readPick);
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

  const variant = SOJOURNER_VARIANTS[idx];
  const total = SOJOURNER_VARIANTS.length;
  const next = () => setIdx((i) => (i + 1) % total);
  const prev = () => setIdx((i) => (i - 1 + total) % total);

  function select(id: SojournerVariant) {
    try {
      localStorage.setItem(SOJOURNER_PICK_KEY, id);
      window.dispatchEvent(new Event(PICK_EVENT));
    } catch {
      // Preview-only failure; selection still announced below.
    }
    setPicked(id);
    toast.success(`${id} selected — veil + /token preview it live. Tell chat to hardwire it.`);
  }

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
      `# ${variant.name} modification brief (${new Date().toISOString().slice(0, 10)})`,
      ``,
      `Settings: speed=${speed} ring=${ring} waypoints=${waypoints ? "on" : "off"} glow=${glow ? "on" : "off"} spinning=${spinning ? "on" : "off"} size=${size}`,
      ``,
      `## Notes`,
      notes.trim() || "(no notes yet)",
      ``,
      `Apply to apps/web/src/components/brand/tokens.tsx (${variant.id}) and confirm in /logo.`,
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
      `<!-- Sojourner Builds ${variant.name} — portable: paste anywhere -->\n<style>\n${PORTABLE_CSS}\n</style>\n${svg}`,
      "Portable token copied ✓"
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="font-mono text-[11px] tracking-widest text-amber-400">TEMP DEV ROOM — NOT LINKED, 404 IN PROD</p>
      <h1 className="ui-title mt-1">Pick your mark</h1>
      <p className="ui-sub">
        Step through all 3 with Next. Select one to preview it live everywhere, perfect it here, then export.
        {picked && (
          <> Current pick: <span className="font-mono text-[#ff5c7a]">{picked}</span>.</>
        )}
      </p>

      {/* Stepper */}
      <div className="mt-4 flex items-center gap-3">
        <button onClick={prev} className="btn-ghost" aria-label="Previous mark">‹ Prev</button>
        <div className="flex gap-1.5" role="tablist" aria-label="Variants">
          {SOJOURNER_VARIANTS.map((v, i) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              title={v.name}
              className={`h-2.5 rounded-full transition-all ${i === idx ? "w-8 bg-[#ff2a55]" : "w-2.5 bg-slate-700 hover:bg-slate-600"}`}
            />
          ))}
        </div>
        <span className="font-mono text-xs text-slate-400">{idx + 1}/{total}</span>
        <button onClick={next} className="btn-ghost ml-auto" aria-label="Next mark">Next ›</button>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="ui-panel flex flex-col items-center p-8">
          <h2 className="text-lg font-semibold">{variant.name}</h2>
          <p className="mt-1 max-w-sm text-center text-sm text-slate-400">{variant.story}</p>
          <div ref={previewRef} className="mt-4">
            <SojournerToken
              variant={variant.id}
              size={size}
              spinning={spinning}
              speed={speed}
              ring={ring}
              waypoints={waypoints}
              glow={glow}
            />
          </div>
          <button onClick={() => select(variant.id)} className="btn-primary mt-5 h-10 px-6">
            {picked === variant.id ? "✓ Selected — previewing live" : `Select ${variant.name}`}
          </button>
          <label className="mt-5 flex w-full items-center gap-3 text-xs text-slate-400">
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
              placeholder={`e.g. ${variant.name}: thicker strokes, slower spin, dimmer glow…`}
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
