"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!isFirebaseConfigured || !auth) {
    return (
      <Link
        href="/settings"
        className="flex h-9 items-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
        title="Set NEXT_PUBLIC_FIREBASE_* env vars (see apps/web/.env.example)"
      >
        Connect Firebase
      </Link>
    );
  }

  const authInstance = auth;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-40 truncate text-sm text-zinc-600 sm:block dark:text-zinc-400">
          {user.email ?? user.uid}
        </span>
        <button
          onClick={() => {
            setBusy(true);
            setError(null);
            signOut(authInstance).finally(() => setBusy(false));
          }}
          disabled={busy}
          className="flex h-9 items-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await signInWithPopup(authInstance, new GoogleAuthProvider());
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in failed");
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="flex h-9 items-center rounded-full bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
      >
        {busy ? "…" : "Sign in with Google"}
      </button>
      {error ? (
        <span className="max-w-52 truncate text-xs text-red-600" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
