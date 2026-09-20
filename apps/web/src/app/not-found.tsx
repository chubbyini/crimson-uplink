import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-sky-400">
        404 — off the grid
      </p>
      <h1 className="mt-2 text-3xl font-bold text-white">
        This sector doesn&apos;t exist
      </h1>
      <p className="mt-3 text-sm text-slate-400">
        The page moved or was never uplinked. Head back to mission control:
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/"
          className="flex h-11 items-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 font-mono text-sm font-bold text-white"
        >
          HOME
        </Link>
        <Link
          href="/ideas"
          className="flex h-11 items-center rounded-xl border border-slate-800 bg-slate-900/80 px-6 font-mono text-sm font-bold text-slate-300"
        >
          IDEA BANK
        </Link>
      </div>
    </main>
  );
}
