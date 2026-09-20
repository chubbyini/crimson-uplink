# Crimson Uplink — Product

## Vision

Sources → idea bank → drafter → Telegram approval → publish (LinkedIn, Dev.to, X).

A multi-user, bring-your-own-keys content engine for developers. Each user
connects their own sources, models, and publish targets. The system curates
every morning, drafts in the user's voice, and only publishes after explicit
approval — from the phone via Telegram or from the Next.js dashboard.

## Pipeline

1. **Sources** — RSS/blogs/newsletters/YouTube (`rss-parser`), Bluesky
   (`@atproto/api`), Mastodon (`masto`), Hacker News (Algolia API), Dev.to
   API, GitHub (`@octokit/rest`, recently-created-by-stars), npm download
   trends. X/LinkedIn feeds are NOT scraped (ToS + paywall); follow the same
   people via RSS/Bluesky instead.
2. **Idea bank** — morning job pulls, dedupes by normalized URL hash, Gemini
   (Flash Lite, `ai` + `zod`) scores to top 10 with angle + source link +
   suggested format. Stored per-user in Firestore (unbounded; dashboard pages
   server-side in cursors).
3. **Drafter** — Groq `llama-3.3-70b-versatile` (`@ai-sdk/groq`,
   `generateText`) writes in the user's voice using `style.md` + past samples.
   Gemini = brains (structure), Groq = voice (prose).
4. **Approval** — two gates: idea Approve/Skip, then draft
   Approve/Edit/Reject. Telegram (`grammy` inline keyboards) + dashboard.
   No blind auto-post in MVP.
5. **Publish** — LinkedIn first (manual copy-paste → API), Dev.to second
   (`api_key`, `canonical_url` for Medium import), X last. Medium via manual
   import. Dev.to views auto-sync; LinkedIn views entered manually (no
   personal analytics API).

## Scope

**In:** per-user Firestore (`users/{uid}/...`), BYOK settings page, Telegram
digest + review, Vercel Cron per-user runner, Dev.to auto-stats, Next.js
dashboard (pipeline, drafts, analytics, settings).

**Out of MVP:** Google Trends (unofficial, fragile), X/LinkedIn scraping,
vector DB (corpus fits in 1M context), blind auto-post.

## MVP Tradeoffs (revisit post-MVP)

Agreed 2026-09-20. Each shortcut ships in MVP and gets hardened right after.

### 1. Shared Telegram bot
- **Decision:** one shared bot (e.g. `@crimson_uplink_bot`) + per-user
  `TELEGRAM_CHAT_ID`. Callbacks carry `{uid, ideaId}` and verify `chatId`.
- **Accepted risk:** single token blast radius, shared rate limits.
- **Switch later:** per-user BotFather tokens in Settings (`TELEGRAM_BOT_TOKEN`
  per user).

### 2. Per-user API keys stored plaintext in Firestore
- **Decision:** `users/{uid}/settings` holds `GEMINI_KEY`, `GROQ_KEY`,
  `DEVTO_KEY`, `LINKEDIN_TOKEN` as-is, Firestore rules locked to owner
  (`request.auth.uid == uid`) so the cron job can read them.
- **Accepted risk:** anyone with DB admin access can read keys.
- **Switch later:** KMS/Secret Manager envelope encryption + per-user
  LinkedIn OAuth app (refresh flow, no pasted tokens).

### 3. LinkedIn manual-paste before API; Dev.to-auto + LinkedIn-manual analytics
- **Decision:** LinkedIn ships as copy-ready Telegram/dashboard text first
  (3000-char limit, single image), API second. Analytics: Dev.to auto-sync
  nightly, LinkedIn/Medium/X manual number fields.
- **Accepted risk:** extra 30s of manual work per LinkedIn post.
- **Switch later:** full LinkedIn API publish + any available analytics import.

## Stack

TypeScript, Next.js (App Router) + Tailwind, Firebase (Auth, Firestore, App
Hosting), Vercel Cron, `ai` + `zod`, `grammy`, `rss-parser`, `@atproto/api`,
`masto`, `@octokit/rest`, `gray-matter`, `cheerio` + `turndown`.
