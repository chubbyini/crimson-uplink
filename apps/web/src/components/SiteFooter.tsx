/**
 * Tactical footer. Always in normal page flow (never fixed), so it can
 * never cover a feature — it simply sits at the bottom of the page.
 */
export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950 py-6 px-6 text-center font-mono text-xs text-slate-500">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>CRIMSON UPLINK // PRECISION CONTENT AUTOMATION ENGINE</p>
        <p className="text-[11px] text-slate-600">
          BYOK ARCHITECTURE • GROQ GPT-OSS 120B • GEMINI 3.5 FLASH LITE
        </p>
      </div>
    </footer>
  );
}
