# Crimson Uplink

Multi-user, bring-your-own-keys content engine for developers. Every morning it
pulls developer trends, scores the top 10 into your idea bank, drafts
full-length articles in your voice, and DMs you a Telegram digest to approve.
You publish to Dev.to and LinkedIn in one tap each.

```
                    ┌─────────────┐
                    │  Vercel Cron │  06:00 daily + Telegram webhook
                    │  /api/cron/* │
                    └──────┬──────┘
                           │ per user (own keys)
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌────────────────┐
│    INGEST     │  │     SCORE     │  │     DRAFT      │
│ HN · RSS · YT │  │ Gemini Flash  │  │ Groq GPT-OSS   │
│ Bluesky · GH  │─▶│ top 10 ideas  │─▶│ article + edit │
│ npm · Dev.to  │  │ + TG digest ✅ │  │ + LinkedIn ver │
└───────┬───────┘  └───────────────┘  └───────┬────────┘
        │ URL-hash dedupe                     │ approve gate
        ▼                                     ▼
┌───────────────┐                   ┌────────────────┐
│  Firestore    │                   │    PUBLISH     │
│ items·ideas·  │                   │ Dev.to API ·   │
│ drafts·corpus │                   │ LinkedIn API · │
└───────────────┘                   └───────┬────────┘
                                           ▼
                                    ┌────────────────┐
                                    │  ANALYTICS     │
                                    │ auto + manual  │
                                    └────────────────┘
```

On demand: **Content** (topics → research → ideas → auto-draft) and
**Corpus** (your own writing → gaps, follow-ups, repurposing).

## Screenshots

> Placeholders — capture from the running app into `docs/screenshots/`.

| Dashboard | Idea bank | Drafts |
|---|---|---|
| `docs/screenshots/dashboard.png` | `docs/screenshots/ideas.png` | `docs/screenshots/drafts.png` |

| Telegram digest | LinkedIn-ready | Analytics |
|---|---|---|
| `docs/screenshots/telegram.png` | `docs/screenshots/linkedin-ready.png` | `docs/screenshots/analytics.png` |

## 60-second demo

1. **Settings** — paste Gemini + Groq keys, add an RSS feed, save.
2. **Settings → Run ingest now** — articles land in Sources.
3. **Ideas → Score fresh items** — top 10 with angles; digest hits Telegram.
4. Approve one → **Draft with Groq** → open **Drafts**, Preview, Edit.
5. **Publish to Dev.to** → View live; **Analytics → Sync** for stats.

## Structure

- `apps/web` — Next.js dashboard + API (`src/app`, `src/lib`, `src/components`)
- `PRODUCT.md` — vision, scope, MVP tradeoffs
- `docs/` — runbooks (`FIREBASE_SETUP.md`, `LINKEDIN_SETUP.md`),
  specs (`CORPUS_SPEC.md`), analysis (`TECHNICAL_DEEP_DIVE.md`)

## Dev

```bash
npm install          # root (workspaces)
npm run dev          # → apps/web on :3000
```

Env: copy `apps/web/.env.example` → `apps/web/.env.local`, fill Firebase web
config + `FIREBASE_SERVICE_ACCOUNT_JSON` (one line) + `ENCRYPTION_KEY`
(`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

## Deploy (Vercel)

Root Directory `apps/web`; env vars = same set as `.env.local` plus
`TELEGRAM_BOT_TOKEN`, `CRON_SECRET`. Then: Firebase authorized domains +=
prod domain; `setWebhook` → `/api/telegram`; cron `0 6 * * *` is in
`apps/web/vercel.json`.
