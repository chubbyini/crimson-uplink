const stages = [
  { name: "Sources", desc: "RSS, YouTube, Bluesky, HN, GitHub, npm" },
  { name: "Idea bank", desc: "Deduped, scored, per-user in Firestore" },
  { name: "Drafter", desc: "Groq voice, Gemini brains" },
  { name: "Approval", desc: "Telegram + dashboard review" },
  { name: "Publish", desc: "LinkedIn first, Dev.to second" },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-10 px-8 py-20">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-red-700">
            Crimson Uplink
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Sources → idea bank → drafter → approval → publish
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Multi-user, bring-your-own-keys. LinkedIn first, Dev.to second.
            Dashboard lives here; Telegram handles approvals on your phone.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2">
          {stages.map((s, i) => (
            <li
              key={s.name}
              className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"
            >
              <p className="text-xs font-mono text-zinc-500">
                0{i + 1}
              </p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">
                {s.name}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {s.desc}
              </p>
            </li>
          ))}
        </ol>
        <div className="flex gap-3">
          <a
            href="/settings"
            className="flex h-11 items-center rounded-full bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800"
          >
            Open settings
          </a>
          <a
            href="/analytics"
            className="flex h-11 items-center rounded-full border border-black/10 px-5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            View analytics
          </a>
        </div>
      </main>
    </div>
  );
}
