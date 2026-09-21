# Crimson Uplink — Technical Deep Dive

*Architecture, decisions, tradeoffs, every production error, and what's next.
Written from the commit history (`git log`, ~45 commits) and a full re-scan
of the tree. Last updated: 2026-09-21.*

## 1. What the system is

Crimson Uplink is a multi-user, bring-your-own-keys (BYOK) content engine for
developers. Every morning it pulls developer trends from 8+ sources, deduplicates
them, scores the top 10 into a per-user idea bank with Gemini, drafts in the
user's voice with Groq, delivers a Telegram digest with approve/skip buttons,
and publishes to Dev.to and LinkedIn after explicit human approval. An
on-demand `/content` flow does the same from user-supplied topics, and a
morning cron runs the whole loop for every user unattended.

Pipeline: `sources → items → ideas → drafts → approval → publish → stats`.

## 2. Architecture map

### 2.1 Runtime layout

- **One Next.js App Router app** (`apps/web/`, TypeScript, Tailwind v4) serves
  both the dashboard and the API. No separate backend, no workers, no queue.
- **Firebase** provides Auth (Google), Firestore (all state), and nothing else.
  No Cloud Functions, no Firebase Hosting (hosted on Vercel).
- **Vercel** hosts the app, runs the 06:00 cron (`vercel.json` → Krons → 
  `GET /api/cron/morning`), and receives the Telegram webhook
  (`POST /api/telegram`).
- Repo root is an npm workspaces monorepo (`apps/*`); the root `package.json`
  holds only workspace wiring. The lockfile lives at the root.

### 2.2 API routes (all dynamic, Node runtime)

| Route | Method | Auth | Does |
|---|---|---|---|
| `/api/ingest` | POST | ID token | Follows-based pull → dedupe-store `items` |
| `/api/ideas` | POST | ID token | Score latest items → `ideas` + Telegram digest |
| `/api/content` | POST | ID token | Topic search → store → score → auto-draft top idea |
| `/api/drafts` | POST | ID token | Groq-draft an approved idea |
| `/api/drafts/edit` | POST | ID token | Groq-edit a draft from instructions |
| `/api/drafts/refine-linkedin` | POST | ID token | Compress article → <3000-char LinkedIn post |
| `/api/publish/devto` | POST | ID token | Publish approved draft to Dev.to |
| `/api/publish/linkedin` | POST | ID token | Publish approved linkedin draft via Posts API |
| `/api/stats/sync` | POST | ID token | Refresh Dev.to views/reactions/comments |
| `/api/cron/morning` | GET | `CRON_SECRET` | Full loop for every enabled user |
| `/api/telegram` | POST | optional webhook secret | Button taps + `/topics` DMs |
| `/api/diag` | GET | none | Env presence/validity, no secret bytes |
| `/api/health` | GET | none | Liveness |

Every user-facing route follows the same guard ladder, in order: 503 if the
server key is missing → 401 without/invalid ID token → 400 for missing
prerequisites (settings, keys, items, approval state) → 502 with the upstream
provider's verbatim error → 200. The UI surfaces each layer's message directly,
which is why debugging never required server access.

### 2.3 Libraries

- `lib/ingest/` — one module per source (`hn`, `rss`, `bluesky`, `mastodon`,
  `github`, `npm`, `devto`) plus `normalize.ts` (URL canonicalization +
  16-char sha256 dedupe keys). All public reads use plain `fetch`; no SDKs.
- `lib/search/` — topic-query variants (`query.ts`: HN Algolia, GitHub search,
  Lobsters hottest, Stack Overflow, Medium tag RSS) fanned out by `index.ts`.
- `lib/ideas/` — zod schemas (`schema.ts`) + Gemini scoring (`score.ts`) with a
  knowledge-cutoff fallback (`generateIdeasFromTopics` when items are scarce).
- `lib/draft/` — `generateDraft`, `editDraftWithGroq`, `refineForLinkedin`,
  all `generateText` on Groq with `style.md` as the system voice.
- `lib/publish/` — Dev.to (`api-key` header) and LinkedIn (Posts API, URN
  resolved via `userinfo`) publishers.
- `lib/pipeline.ts` — shared `storeItems` (chunked reads/writes, undefined
  stripping), `ingestForUser`, `scoreForUser`, `loadSettings`. The cron, the
  buttons, and the bot all run through these.
- `lib/telegram.ts` — grammy sender (digest cards + ✅/⏭ inline keyboards),
  tap handler with chat-ownership checks, `/topics` DM research flow.
- `lib/firebase-admin.ts` — lazy Admin SDK init, resilient token verification
  (see §4.7), users-registry cron support.
- `lib/settings.ts` / `settings-store.ts` — zod BYOK schema + Firestore
  read/write (+ profile-doc write feeding the cron registry).

### 2.4 Data model (Firestore, per-user)

```
users/{uid}                      ← registry doc (cron reads collection("users"))
users/{uid}/settings/config      ← BYOK keys, follows, toggles
users/{uid}/items/{urlHash}      ← deduped articles (firstSeenAt preserved)
users/{uid}/ideas/{autoId}       ← title/angle/format/sources/score, status machine
users/{uid}/drafts/{autoId}      ← body, model, status, linkedinBody variant
users/{uid}/publishes/{autoId}   ← platform/url/ids, auto + manual stats
```

Idea/draft status machines: `new → approved|skipped → drafted → published`
(ideas), `pending_review → approved|rejected|published` (drafts). Firestore
rules are owner-only (`request.auth.uid == uid`) across the whole subtree.

### 2.5 Pages

`/` (landing for visitors, mission-control dashboard for members), `/items`
(SOURCES), `/ideas` (bank, cursor-paginated), `/content` (topic research),
`/drafts` (review/edit/publish), `/drafts/linkedin-ready` (3000-char preview),
`/analytics` (publish log + stats), `/settings` (BYOK + run-now), `/privacy`
(LinkedIn app requirement), custom `not-found`. Signed-out users are bounced to
`/` from every page and see no nav links. A hamburger dropdown serves mobile;
desktop gets an active-state nav.

## 3. Technical decisions and tradeoffs

### 3.1 Multi-user BYOK from day one (not single-user first)

Every key (Gemini, Groq, Dev.to, LinkedIn, GitHub) lives in the user's own
`settings` doc; the server holds only Firebase + Telegram bot + cron secrets.
Cost: every feature had to be designed per-user (token threading, per-user
failure isolation in cron). Payoff: zero marginal LLM cost to operate, no
billing system needed, and onboarding is "paste keys" instead of OAuth builds.

### 3.2 Shared Telegram bot + plaintext keys (explicit MVP debt)

Documented in `PRODUCT.md`: one `@CrimsoncrawlerBot` routes by stored chat ID;
keys are stored as-is in Firestore under owner-only rules. Accepted blast
radius (one token) and admin-visibility risk in exchange for shipping weeks
earlier. The switch-over (per-user bot tokens, KMS/Secret Manager envelope
encryption, per-user LinkedIn OAuth) is specced as the first post-MVP job.

### 3.3 Two-model split: Gemini = brains, Groq = voice

Ideas need structured output over a large context (Gemini Flash-Lite: 1M
context, best `generateObject`+zod support, 1500 req/day free). Drafts need
prose quality with no schema (Groq: fast, free, no card). The split survived
contact with reality twice — both default models were retired mid-project
(§4.4) and each swap touched exactly one line plus a `GROQ_MODEL` env override
added as insurance.

### 3.4 No vector DB, no embeddings

At this volume the entire corpus (titles + summaries + tags) fits in a single
Gemini context. A vector store would add hosting, sync jobs, and embedding
costs for zero retrieval gain. Revisit only when the corpus stops fitting.

### 3.5 Vercel cron over GitHub Actions

Single deployment owns code + schedule + secrets; per-user fan-out lives in
one route. GitHub Actions would have split secrets/scheduling across systems.
Cost: Hobby function timeouts (~60s) constrain the morning run — hence
`maxDuration`, per-user try/catch, and per-source failure isolation.

### 3.6 URL-hash dedupe, not similarity (yet)

Canonicalize (lowercase host, strip tracking params/fragments/trailing slash)
→ sha256 → 16 hex chars → document ID. Same article from five sources collapses
to one doc with `firstSeenAt` preserved and `lastSeenAt` refreshed. O(1),
no ML, survives restarts. Known gap: near-duplicate *different* URLs (syndication,
UTM survivors) still double-count — semantic dedupe is roadmap.

### 3.7 Copy-paste before API, always

LinkedIn shipped as copy-ready text first, API second; Dev.to shipped API-first
only because its key model is trivial. Each publish path requires a prior
human approval state server-side (`approved` drafts only) — three gates total
(idea → draft → publish), no blind auto-post anywhere.

### 3.8 Plain `fetch` over vendor SDKs

Octokit, `masto`, `@atproto/api` were all dropped for public reads: fewer deps,
same data, smaller serverless bundles. SDKs return only if authed actions are
needed.

### 3.9 Manual stats where APIs don't exist

Only Dev.to offers free personal analytics. LinkedIn/X/Medium get manual
number fields. The analytics page is honest about this instead of faking it.

### 3.10 Firestore chunking + undefined stripping

`storeItems` chunks `getAll` (250) and batch commits (400, under the 500-op
limit); `cleanDoc` strips `undefined` (Firestore rejects it). Both were
production bugfixes (§4.8), now structural.

## 4. Every production error, with causes

### 4.1 Hydration mismatch — cause: a Chrome extension, not our code

`crxlauncher-*` attributes injected into `<html>` before React loaded. Fix:
none in code; verify in incognito. Lesson: extension-injected DOM is always
suspect #1 for hydration diffs.

### 4.2 `CONFIGURATION_NOT_FOUND` on sign-in — cause: Google provider disabled

Key reached Google fine; the project had no sign-in configuration. Fix: enable
Google in Authentication. Lesson: 400-from-provider beats key-error — read the
JSON, not the status.

### 4.3 `.env.local` multi-line service-account paste — cause: dotenv is 1-D

Pretty-printed JSON across 12 lines parsed as garbage variables. Fix: squash to
one line programmatically (never by hand). Lesson: secrets travel as files,
never chat; validation must check *key usability* (`cert()`), not just JSON
shape.

### 4.4 Model retirements (three of them)

`gemini-2.0-flash-lite` → `gemini-3.5-flash-lite`; `llama-3.3-70b-versatile`
decommissioned 2026-08-16 → `openai/gpt-oss-120b`. Each surfaced verbatim
through the 502 path and each fix was one line. Lesson: pin nothing by
default, expose `GROQ_MODEL`-style overrides, and generalize to a model
registry with health checks (roadmap).

### 4.5 Ghost-button washout → Tailwind v4 dark-variant root cause

White-on-white cards looked like a button problem; it was systemic: Tailwind
v4 moved `dark:` to `prefers-color-scheme` while the layout pins `class="dark"`,
so zero dark styles applied. One-line fix (`@custom-variant`). Lesson: fix the
layer, not the symptom — and re-check the symptom list after.

### 4.6 Deploy failures in sequence

Uncommitted components (`CarmineTitle`, `CelestialO`) → module-not-found on a
build that was green locally (lesson: deploy only sees pushed code); missing
Linux `lightningcss` bindings in a Windows-generated lockfile → pinned as
`optionalDependencies` (lesson: lockfiles are platform-scoped unless forced);
stale Node default → `engines: 22.x` pin. Each pushed Vercel exactly one step
forward — read the head of the error, never the tail.

### 4.7 The `jose` ESM saga (the big one)

Symptom: every authed route 500s with empty bodies on Vercel, green locally.
Chain: Turbopack production externalizes `firebase-admin/auth` →
`jwks-rsa` (CJS) `require()`s ESM-only `jose` v6 (no CJS entry at all) →
`ERR_REQUIRE_ESM`. Note Node ≥22.12 *usually* tolerates require(esm) — the
serverless runtime didn't. Fixes, layered: (1) webpack prod builds
(`--webpack`) so the chain bundles instead of externalizing; (2) `firebase-admin/auth`
never statically imported — lazy dynamic import only; (3) token verification
falls back to Identity Toolkit REST (`accounts:lookup`, pure fetch); (4) cron
dropped `listUsers` for a Firestore users registry (`users/{uid}` profile docs
written on Settings save + backfilled). The route contract never changed, so
the UI needed zero edits. Lesson: isolate runtime-hostile dependency chains
behind a pure-`fetch` fallback, and never let user enumeration depend on Auth.

### 4.8 Firestore + serverless limits

Batch 500-op ceiling → chunked commits; `undefined` field rejection → `cleanDoc`;
function timeouts → `maxDuration = 60`, `force-dynamic`, per-user/per-source
isolation so one slow feed can't sink the run.

### 4.9 Secret exposures (process failures, all remediated)

Service-account key pasted in chat twice, Gemini key once, Telegram token once.
Each was rotated (or scheduled) and the workflow changed: file paths, never
pastes; secret-shape validation before use; `.env.local` verified gitignored.
The code never leaked secrets (diag endpoint returns booleans/lengths only) —
the leaks were all human transport. Lesson worth keeping: make the safe path
the easy path (path-handoff tooling, not discipline).

### 4.10 A misdiagnosis worth recording

`apps/web/AGENTS.md`'s "this is NOT the Next.js you know" block was flagged as
a possible prompt injection. It is in fact Next.js 16's legitimate agent-rules
co-generation, committed by the project owner. Flagging was right; concluding
would have been wrong. Verify, then trust.

## 5. Possible improvements (prioritized)

### P0 — Security debt (from §3.2)
1. KMS/Secret Manager envelope encryption for per-user keys.
2. Per-user LinkedIn OAuth login (kills the 60-day manual refresh).
3. Set `TELEGRAM_WEBHOOK_SECRET` in prod (route already enforces it when set).
4. API-key restrictions in Google Cloud (HTTP referrers + API scoping).

### P0 — Reliability
5. Cron chaining: split ingest/score/digest per user into sequential calls so
   no run can hit the 60s ceiling as volume grows.
6. Retry with backoff on provider 429/5xx (Gemini, Groq, GitHub search) +
   OpenRouter fallback already specced.
7. Idempotency: cron run IDs on ideas/digests so Telegram retries can't
   double-send.
8. Rate-limit `/topics` per chat (cooldown) — currently unbounded.

### P1 — Quality flywheel
9. **Own-writing corpus** (the one unbuilt original feature): import Dev.to
   articles, repo markdown, LinkedIn export → Gemini finds gaps, follow-ups,
   repurposing candidates.
10. Semantic near-duplicate collapsing (embeddings at ingest, cosine threshold)
    to close the §3.6 gap.
11. Scoring calibration: feed publish performance back into idea weights.
12. Evals: golden topic→idea→draft set, scored on every model swap (retirements
    *will* recur — §4.4).
13. Model registry + startup health check generalizing the `GROQ_MODEL` hack.

### P1 — Engineering hygiene
14. Tests: `vitest` for normalize/dedupe/chunking/prompt builders; Playwright
    smoke (sign-in stub → ingest → score → draft); contract tests for each
    provider's response shape.
15. CI: lint + typecheck + build + tests on PR; Vercel preview deploys as the
    quality gate (would have caught §4.6-class issues pre-merge).
16. Structured run logging (JSON lines per user/stage) + Sentry; Telegram
    failure alerts already partially exist.
17. Cost caps per user per day (Gemini/Groq free tiers are shared org-wide).

### P2 — Features
18. X threads (splitter + post chain) — auth-heavy, do last as originally planned.
19. LinkedIn single-image upload (currently text-only).
20. Medium import automation via Dev.to `canonical_url`.
21. Exa/Tavily deep-research provider for `/content` (verified free tiers exist).
22. Draft scheduling queue + content calendar view.
23. Newsletter repurposing (Dev.to → LinkedIn → X from one draft).

## 6. Decision log (one-line each)

| Decision | Why | Cost if wrong |
|---|---|---|
| BYOK multi-user day one | no billing, zero marginal cost | per-user plumbing everywhere |
| Shared bot + plaintext keys | ship weeks earlier | must harden before strangers |
| Gemini ideas / Groq voice | structured output vs prose | two retirements survived, one line each |
| No vector DB | corpus fits in context | revisit at scale |
| Vercel cron | one system owns code+schedule+secrets | 60s ceiling shapes the code |
| URL-hash dedupe | O(1), restart-proof | misses near-duplicates |
| Copy-paste before API | value on day one | manual seconds per post |
| Plain fetch over SDKs | smaller bundles, same data | re-add SDKs if authed actions come |
| Webpack over Turbopack prod | ESM-chain crash (§4.7) | slower builds, revisit yearly |
| REST auth fallback + users registry | remove Auth-module dependence | extra code paths to maintain |
| 10/run + cursor pagination | unbounded bank, constant bandwidth | Gemini input still capped at 100 |
| `/topics` in Telegram | research where the user already is | unbounded runtime → needs cooldowns |

## 7. How to extend this system (notes for the next engineer)

- New source: add `lib/ingest/<name>.ts` returning `RawItem[]`, wire into
  `runIngest` + `searchTopics` if queryable, add a Settings field if it needs
  follows. Per-source try/catch is mandatory, not stylistic.
- New model: change one ID (+ env override), then run the eval set (§5.12).
  Assume every provider ID has a shelf life.
- New publish target: `lib/publish/<target>.ts` + route enforcing the approval
  gate + `publishes` logging + stats mapping. Never publish from unapproved state.
- New scheduled work: extend the cron route (per-user try/catch), not new infra.
- Debugging prod: `/api/diag` first (env/admin status), Vercel function logs
  second (real stacks), local `next start` third. Never trust the browser's
  error text alone.
