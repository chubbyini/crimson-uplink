"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/items", label: "SOURCES" },
  { href: "/ideas", label: "IDEAS" },
  { href: "/content", label: "CONTENT" },
  { href: "/drafts", label: "DRAFTS" },
  { href: "/analytics", label: "ANALYTICS" },
  { href: "/settings", label: "SETTINGS" },
];

export function DesktopNav() {
  const path = usePathname();
  return (
    <nav className="hidden sm:flex items-center gap-4 font-mono text-xs font-medium">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={path === l.href ? "page" : undefined}
          className={
            path === l.href
              ? "text-sky-300"
              : "text-slate-400 hover:text-sky-400 transition-colors"
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative sm:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 font-mono text-base text-slate-300"
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <nav className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-slate-800 bg-slate-950/95 py-2 font-mono text-xs font-medium shadow-xl backdrop-blur-xl">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={path === l.href ? "page" : undefined}
              className={`block px-4 py-2.5 ${
                path === l.href
                  ? "bg-sky-500/10 text-sky-300"
                  : "text-slate-400 hover:bg-white/5 hover:text-sky-300"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
