import Link from "next/link";
import ThemedTextFrame from "@/components/ThemedTextFrame";
import PipelineVisualizer from "@/components/PipelineVisualizer";
import BioMechSimulator from "@/components/BioMechSimulator";
import MechDesignerStats from "@/components/MechDesignerStats";
import VoiceMatrixCard from "@/components/VoiceMatrixCard";

export default function Home() {
  return (
    <main className="flex w-full flex-col items-center px-4 py-12 sm:px-8 md:py-20">
      <div className="w-full max-w-6xl space-y-16">
        
        {/* HERO SECTION - SEAMLESS WITH BACKGROUND WARSHIP & VEINS */}
        <section className="relative text-center space-y-6 pt-4">
        

          {/* Main Title with Themed SVG Surrounding Frame (No Gradient) */}
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl md:text-7xl leading-tight">
            CARMINE<br className="hidden sm:inline" />
            <ThemedTextFrame text="CONTENT AUTOMATION" />
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-2xl text-base text-slate-300 sm:text-lg leading-relaxed font-normal">
            Harvest morning developer trends, score viral angles with{" "}
            <strong className="text-sky-300 font-semibold">Gemini 2.0 Flash Lite</strong>, synthesize drafts in your voice with{" "}
            <strong className="text-rose-400 font-semibold">Groq Llama 3.3</strong>, and approve directly on your phone via{" "}
            <strong className="text-white font-semibold">Telegram</strong>.
          </p>

          {/* Action Button Deck */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/settings"
              className="group relative flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-7 font-mono text-sm font-bold text-white shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-95"
            >
              <span>INITIALIZE ENGINE</span>
              <span className="font-sans text-base transition-transform group-hover:translate-x-1">→</span>
            </Link>

            <Link
              href="/analytics"
              className="flex h-11 items-center rounded-xl border border-slate-800 bg-slate-900/80 px-7 font-mono text-sm font-bold text-slate-300 backdrop-blur-md transition-all hover:border-sky-500 hover:text-white"
            >
              TELEMETRY ANALYTICS
            </Link>
          </div>
        </section>

        {/* TELEMETRY STATS GRID */}
        <section>
          <MechDesignerStats />
        </section>

        {/* PIPELINE MATRIX VISUALIZER */}
        <section id="pipeline" className="space-y-4">
          <div className="text-center sm:text-left">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
              ARCHITECTURE OVERVIEW
            </span>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              5-Stage Bio-Neural Data Pipeline
            </h2>
          </div>
          <PipelineVisualizer />
        </section>

        {/* INTERACTIVE TEST CHAMBER SIMULATOR */}
        <section id="simulator" className="space-y-4">
          <div className="text-center sm:text-left">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
              LIVE PREVIEW & SVG DISINTEGRATION
            </span>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Test Drive the Content Synthesis Engine
            </h2>
          </div>
          <BioMechSimulator />
        </section>

        {/* DUAL-BRAIN VOICE MATRIX */}
        <section>
          <VoiceMatrixCard />
        </section>

        {/* TARGET PLATFORMS DECK */}
        <section className="mta-card rounded-2xl p-8 text-center space-y-6">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
              MULTI-CHANNEL BROADCAST
            </span>
            <h3 className="mt-1 text-2xl font-bold text-white">
              Target Uplink Networks
            </h3>
            <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
              Automated Dev.to API sync with canonical tags, formatted LinkedIn matrix copy, and optional X/Medium import pipelines.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white">DEV.TO API</span>
                <span className="rounded-full bg-emerald-950 px-2 py-0.5 font-mono text-[10px] text-emerald-400 font-bold">
                  AUTO-SYNC
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Direct post creation via API key + canonical URL import tags.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white">LINKEDIN</span>
                <span className="rounded-full bg-sky-950 px-2 py-0.5 font-mono text-[10px] text-sky-400 font-bold">
                  COPY-READY
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                3,000-char optimized layout with manual paste & telemetry fields.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white">X / MEDIUM</span>
                <span className="rounded-full bg-amber-950 px-2 py-0.5 font-mono text-[10px] text-amber-400 font-bold">
                  EXTENSION
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Medium import via Dev.to RSS feed + Twitter thread drafts.
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
