import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import AuthButton from "@/components/AuthButton";
import { MobileMenu, Sidebar } from "@/components/NavLinks";
import CrimsonVeins from "@/components/CrimsonVeins";
import BackgroundWarship from "@/components/BackgroundWarship";
import CrimsonLightningBackground from "@/components/CrimsonLightningBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crimson Uplink — Bio-Neural Content Engine",
  description: "Precision Bio-Neural Content Engine. Sources → idea bank → dual-brain drafter → telegram approval → multi-platform uplink.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#07090e] text-slate-100 relative font-sans selection:bg-sky-500 selection:text-white bg-mta-grid">
        {/* Background Vascular Vein & Lightning Overlay */}
        <CrimsonVeins />

        {/* Big Seamless Background Disintegrating Warship */}
        <BackgroundWarship />

        {/* Authentic Jagged Crimson SVG Lightning (Bottom Right) */}
        <CrimsonLightningBackground />

        {/* Console Navigation Bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3.5 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-mono text-sm font-bold tracking-wider group"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-500/50 bg-sky-950/60 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.2)] transition-transform group-hover:scale-105">
                ⚡
              </span>
              <span>
                <span className="text-rose-500 font-bold">CRIMSON</span>{" "}
                <span className="text-sky-300">UPLINK</span>
              </span>
            </Link>

            {/* Status Telemetry Pills */}
            <div className="hidden lg:flex items-center gap-2 border-l border-slate-800 pl-4 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 rounded-full border border-sky-900/40 bg-sky-950/40 px-2.5 py-0.5 text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                QUANTUM MATRIX: ONLINE
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-0.5 text-slate-400">
                PRECISION ENGINE MK-IV
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <MobileMenu />
            <AuthButton />
          </div>
        </header>

        <Sidebar />

        {/* Main Content Area (clears the fixed sidebar on desktop) */}
        <div className="relative z-10 flex-1 lg:pl-60">{children}</div>

        {/* Tactical Footer */}
        <footer className="relative z-10 border-t border-slate-800 bg-slate-950/90 py-6 px-6 text-center font-mono text-xs text-slate-500">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>
              CRIMSON UPLINK // PRECISION CONTENT AUTOMATION ENGINE
            </p>
            <p className="text-[11px] text-slate-600">
              BYOK ARCHITECTURE • GROQ GPT-OSS 120B • GEMINI 3.5 FLASH LITE
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
