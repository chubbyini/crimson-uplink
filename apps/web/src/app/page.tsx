"use client";

import { useAuth } from "@/components/AuthProvider";
import Dashboard from "@/components/Dashboard";
import { Landing } from "@/components/Landing";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex w-full justify-center px-4 py-24">
        <div className="flex items-center gap-2 font-mono text-xs tracking-widest text-sky-400">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          <span>UPLINKING QUANTUM MATRIX…</span>
        </div>
      </main>
    );
  }

  if (!user) return <Landing />;
  return <Dashboard user={user} />;
}
