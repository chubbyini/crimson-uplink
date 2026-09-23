import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import AuthButton from "@/components/AuthButton";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { MobileMenu, Sidebar } from "@/components/NavLinks";
import SiteFooter from "@/components/SiteFooter";
import { SojournerVeilProvider } from "@sojournerbuilds/mark/next";
import { SojournerToken } from "@sojournerbuilds/mark/tokens";
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
        <AuthProvider>
        <ToastProvider>
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
              <span className="flex h-7 w-7 items-center justify-center transition-transform group-hover:scale-105">
                <SojournerToken size={28} spinning={false} />
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

        <SojournerVeilProvider>
        <Sidebar />

        {/* Main Content Area (clears the fixed sidebar on desktop).
            Footer lives inside the same offset container so the fixed
            sidebar never slides over/under it. Hidden on /pair where the
            fixed SessionDock owns the viewport bottom. */}
        <div className="relative z-10 flex min-h-[calc(100vh-57px)] flex-1 flex-col lg:pl-60">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
        </SojournerVeilProvider>
        </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
