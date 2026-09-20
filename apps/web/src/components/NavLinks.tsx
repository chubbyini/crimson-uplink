"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl sm:hidden">
      <div className="grid grid-cols-6 font-mono text-[10px] font-medium">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={path === l.href ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2.5 ${
              path === l.href ? "text-sky-300" : "text-slate-500"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
