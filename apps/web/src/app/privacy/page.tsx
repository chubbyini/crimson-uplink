import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Crimson Uplink",
  description: "How Crimson Uplink collects, uses, and stores your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 text-sm leading-7 text-slate-300">
      <p className="font-mono text-xs uppercase tracking-widest text-sky-400">
        Legal
      </p>
      <h1 className="mt-2 text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="mt-1 text-xs text-slate-500">Last updated: 20 September 2026</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-white">What Crimson Uplink is</h2>
        <p>
          Crimson Uplink is a bring-your-own-keys content pipeline for
          developers: it ingests public developer content, scores story ideas,
          drafts posts, and — only after your explicit approval — publishes
          them to platforms you connect (LinkedIn, Dev.to, X, Medium).
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-white">Data we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-white">Account identity:</strong> your email
            address and user ID from Google sign-in (via Firebase Authentication).
          </li>
          <li>
            <strong className="text-white">Keys and settings you paste:</strong>{" "}
            third-party API keys (e.g. Gemini, Groq, Dev.to, LinkedIn tokens),
            your Telegram chat ID, and the feeds/handles you follow. Stored in
            your private Firestore area, readable only by you.
          </li>
          <li>
            <strong className="text-white">Your content:</strong> ingested
            articles, generated ideas, drafts, edits, publish records, and
            view/like counts you log or sync.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-white">How we use it</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>To run your pipeline: ingest → ideas → drafts → publish → stats.</li>
          <li>
            Draft text you approve is sent to the AI provider whose key you
            supplied (Google Gemini for ideas, Groq for drafts) and, on publish,
            to the platform you chose — never otherwise.
          </li>
          <li>Nothing is published anywhere without your explicit action.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-white">Sharing</h2>
        <p>
          We do not sell your data. Data leaves our systems only to services
          you connected, when you trigger an action (score, draft, publish,
          stats sync, Telegram digest to your own chat).
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-white">Deletion</h2>
        <p>
          Ask and we delete your account data (settings, items, ideas, drafts,
          publishes). Revoke third-party access anytime in those
          providers&apos; own settings pages; also rotate any exposed keys.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-white">Contact</h2>
        <p>
          Open an issue on the project repository and we will respond there.
        </p>
      </section>
    </main>
  );
}
