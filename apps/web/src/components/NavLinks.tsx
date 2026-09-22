"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { type User } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";

/** Null while signed out (landing stays clean); user once authenticated. */
function useSignedIn(): User | null {
  return useAuth().user;
}

const links = [
  { href: "/items", label: "SOURCES" },
  { href: "/ideas", label: "IDEAS" },
  { href: "/content", label: "CONTENT" },
  { href: "/drafts", label: "DRAFTS" },
  { href: "/pair", label: "PAIR WRITER" },
  { href: "/drafts/linkedin-ready", label: "LINKEDIN READY" },
  { href: "/corpus", label: "VOICE CORPUS" },
  { href: "/analytics", label: "ANALYTICS" },
  { href: "/settings", label: "SETTINGS" },
];

function NavItems({ path, onNavigate }: { path: string | null; onNavigate?: () => void }) {
  return (
    <>
      {links.map((l) => {
        const active = path === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-xs font-medium transition-colors ${
              active
                ? "bg-sky-500/10 text-sky-300"
                : "text-slate-400 hover:bg-white/5 hover:text-sky-300"
            }`}
          >
            <span
              aria-hidden
              className={`h-4 w-1 rounded-full transition-colors ${
                active ? "bg-sky-400" : "bg-slate-800 group-hover:bg-slate-700"
              }`}
            />
            {l.label}
          </Link>
        );
      })}
    </>
  );
}

/** Fixed left rail on desktop. Hidden entirely for signed-out visitors. */
export function Sidebar() {
  const path = usePathname();
  const user = useSignedIn();
  if (!user) return null;
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-800 bg-slate-950/90 backdrop-blur-xl lg:flex">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-24 pb-4">
        <p className="px-3 pb-2 font-mono text-[10px] tracking-widest text-slate-600">
          UPLINK CHANNELS
        </p>
        <NavItems path={path} />
      </nav>
      <div className="border-t border-slate-800 px-5 py-3">
        <p className="truncate font-mono text-[10px] text-slate-600" title={user.email ?? user.uid}>
          {user.email ?? user.uid}
        </p>
      </div>
    </aside>
  );
}

/** Hamburger → slide-over drawer on mobile. Hidden for signed-out visitors. */
export function MobileMenu() {
  const path = usePathname();
  const user = useSignedIn();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="relative lg:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 font-mono text-base text-slate-300"
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/60"
          />
          <nav className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-slate-950 px-3 pt-20 pb-4">
            <p className="px-3 pb-2 font-mono text-[10px] tracking-widest text-slate-600">
              UPLINK CHANNELS
            </p>
            <NavItems path={path} onNavigate={() => setOpen(false)} />
          </nav>
        </>
      )}
    </div>
  );
}
