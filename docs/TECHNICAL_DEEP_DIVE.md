# Crimson Uplink — Technical Deep Dive (v2)

*Architecture, decisions, tradeoffs, every production error, and what's next.
Written from the commit history (~55 commits, two authors working in parallel)
and a full re-scan of the tree. v1 → v2 changes: encryption + masking,
rate limiting, API-based mutations, AI editing suite, LinkedIn-ready flow,
deploy-hardening saga resolution, route config standard, scripts experiment.
Last updated: 2026-09-21.*

## 1. What the system is

Crimson Uplink is a multi-user, bring-your-own-keys (BYOK) content engine for
developers. Every morning it pulls developer trends from 8+ sources, deduplicates
them, scores the top 10 into a per-user idea bank with Gemini, drafts full-length
articles in the user's voice with Groq, delivers a Telegram digest with
approve/skip buttons, refines articles into LinkedIn-ready posts under 3000
characters, and publishes to Dev.to and LinkedIn after explicit human approval.
An on-demand `/content` flow does the same from user-supplied topics (with an
LLM-synthesized fallback when the web is thin), a morning cron runs the whole
loop for every user unattended, and per-user API keys are AES-256-GCM encrypted
at rest with masked-secret API responses.

Pipeline: `sources → items → ideas → drafts → approval → refine → publish → stats`.

## 2. Architecture map

### 2.1 Runtime layout

- **One Next.js App Router app** (`apps/web/`, TypeScript, Tailwind v4,
  **webpack production builds**) serves dashboard + API. No separate backend,
  no workers, no queue.
- **Firebase** provides Auth (Google), Firestore (all state), nothing else.
- **Vercel** hosts the app, runs the 06:00 cron, receives the Telegram webhook.
- Repo root is an npm workspaces monorepo; the lockfile lives at the root.
- `scripts/` worker experiment was removed (decision: the Vercel cron chain
  covers scheduling; no duplicate ingest logic lives anywhere).

### 2.2 API routes (all: Node runtime, force-dynamic, 60s max)

| Route | Auth | Does |
|---|---|---|
| `/api/ingest` | ID token | Follows-based pull → dedupe-store `items` |
| `/api/ideas` | ID token | Score latest items → `ideas` + Telegram digest |
| `/api/content` | ID token | Topic search → store → score → auto-draft top idea |
| `/api/drafts` | ID token | Groq-draft an approved idea (article-level) |
| `/api/drafts/edit` | ID token | Groq-edit a draft from free-text instructions |
| `/api/drafts/refine-linkedin` | ID token | Compress article → LinkedIn post, char-counted |
| `/api/drafts/delete` | ID token | Delete a draft doc |
| `/api/drafts/status` | ID token | Transition draft status server-side |
| `/api/ideas/status` | ID token | Transition idea status server-side |
| `/api/settings` GET/POST | ID token | Masked read; encrypted merge-write + registry |
| `/api/publish/devto` | ID token | Publish approved draft to Dev.to |
| `/api/publish/linkedin` | ID token | Publish approved linkedin draft via Posts API |
| `/api/stats/sync` | ID token | Refresh Dev.to views/reactions/comments |
| `/api/corpus` + `/api/corpus/analyze` | ID token | Own-writing import + gap/follow-up/repurpose analysis |
| `/api/cron/morning` | `CRON_SECRET` | Full loop for every enabled user |
| `/api/cron/ingest`, `/score`, `/digest` | `CRON_SECRET` | Chained per-stage runner (timeout-proofing) |
| `/api/telegram` | optional webhook secret | Button taps + `/topics` DMs |
| `/api/diag`, `/api/health` | none | Env/admin health (no secret bytes), liveness |

Every route follows the same guard ladder: 503 missing server key → 401
missing/invalid ID token → 429 rate-limited → 400 missing prerequisites →
502 with the upstream error verbatim → 200. Mutations moved server-side
(`ideas/status`, `drafts/status`, `drafts/delete`, settings merge) so clients
never write Firestore directly for state changes — reads remain client SDK.

### 2.3 Libraries

- `lib/ingest/` — one module per source (HN, RSS, YouTube, Bluesky, Mastodon,
  GitHub, npm, Dev.to) + URL canonicalization and 16-char sha256 dedupe keys.
  Plain `fetch` throughout; no vendor SDKs.
- `lib/search/` — topic-query variants (HN Algolia, GitHub, Lobsters hottest,
  Stack Overflow, Medium tag RSS, Dev.to tags). Reddit was dropped: it 403s all
  server-side fetches; Lobsters covers the community slot.
- `lib/ideas/` — zod schemas + Gemini scoring with a topic-synthesis fallback
  (`generateIdeasFromTopics` fires when items < 3 or ideas < 3).
- `lib/draft/` — `generateDraft` (article-level, 800–1500+ words, 4000 tokens),
  `editDraftWithGroq` (instruction edits), `refineForLinkedin` (hook, spacing,
  bullets, hashtags, CTA, hard 3000-char clamp + server-reported char count),
  all on Groq with `style.md` as system voice and `GROQ_MODEL` override.
- `lib/publish/` — Dev.to (`api-key`) and LinkedIn (Posts API, URN via userinfo).
- `lib/pipeline.ts` — shared `storeItems` (250-chunk reads, 400-chunk writes,
  `undefined` stripping), `ingestForUser`, `scoreForUser`, `loadSettings`.
- `lib/telegram.ts` — digest cards + ✅/⏭ keyboards with chat-ownership checks,
  `/topics` DM research flow (chat→uid via `collectionGroup("settings")`).
- `lib/firebase-admin.ts` — lazy Admin init, resilient verification: lazy
  `firebase-admin/auth` → REST `accounts:lookup` fallback → clean 401.
  The auth module is never statically imported (§4.7).
- `lib/crypto.ts` — AES-256-GCM field encryption (`enc:` prefix, random IV per
  write), masked-secret API responses (`Ab12••••…wxyz`, `isMaskedSecret` merge
  guard so masked values never overwrite real keys), **fail-closed master key**
  (throws without `ENCRYPTION_KEY`; the public default is deleted).
- `lib/rate-limit.ts` — sliding-window in-memory limiter, per-UID, 10–30/min
  depending on route. Honest caveat: per-instance memory barely constrains
  serverless concurrency — real enforcement needs Upstash Redis (§5.2).
- `lib/settings.ts` — zod BYOK schema (keys, follows, watchlists, toggles).

### 2.4 Data model (Firestore, per-user, owner-only rules)

```
users/{uid}                      ← registry doc (cron lists collection("users"))
users/{uid}/settings/config      ← BYOK keys (AES-GCM), follows, toggles
users/{uid}/items/{urlHash}      ← deduped articles, firstSeenAt preserved
users/{uid}/ideas/{autoId}       ← title/angle/format/sources/score + topicSearch
users/{uid}/drafts/{autoId}      ← body, model, linkedinBody variant, editedAt
users/{uid}/publishes/{autoId}   ← platform/url/ids, auto + manual stats
```

Status machines: ideas `new → approved|skipped → drafted → published`; drafts
`pending_review → approved|rejected|published` (deletion allowed on
publish/reject paths from the UI).

### 2.5 Pages

`/` (landing ↔ mission-control dashboard by auth state), `/items`,
`/ideas` (cursor-paginated, 20/page, unlimited), `/content`,
`/drafts` (preview/edit/publish/delete), `/drafts/linkedin-ready`
(char-counted LinkedIn preview + copy), `/analytics`, `/settings`,
`/privacy`, custom 404. Signed-out users bounce to `/` and see no nav; mobile
gets a hamburger dropdown, desktop an active-state nav.

## 3. Technical decisions and tradeoffs (v2 additions marked ★)

### 3.1 Multi-user BYOK from day one
Per-user keys in `settings`; server holds only infra secrets. Zero marginal
LLM cost, no billing system — at the price of per-user plumbing everywhere.

### 3.2 Shared bot + encrypted-at-rest keys ★ (was: plaintext)
AES-256-GCM with per-write IVs, masked API responses, merge-safe saves, and a
fail-closed master key. Remaining, accepted: single server-wide key (KMS later),
`decryptField` returns `""` on failure (rotation hazard — re-save promptly
after any key change).

### 3.3 Two-model split surviving three retirements
Gemini (structured ideas) / Groq (prose). `gemini-2.0-flash-lite` →
`gemini-3.5-flash-lite`; `llama-3.3-70b` (retired 2026-08-16) →
`openai/gpt-oss-120b` + `GROQ_MODEL` override. Each swap: one line.

### 3.4 ★ Server-side mutations + masked reads
Clients no longer write state directly; status changes, deletes, and settings
saves go through verified, rate-limited routes that never return plaintext
secrets. Reads stay client SDK (cheap, reactive).

### 3.5 ★ In-memory rate limiting (honestly partial)
Sliding window per UID stops casual abuse and accidental button-mashing, but
per-instance memory does not bind Vercel's concurrent isolates. Upstash Redis
is the real fix (§5.2). The `setInterval` janitor is pointless on serverless
and harmless — delete it when Redis lands.

### 3.6 ★ Lazy auth + REST fallback + users registry
`firebase-admin/auth` is never statically imported; verification tries lazy
admin then pure-`fetch` Identity Toolkit lookup; cron enumerates a Firestore
registry instead of `listUsers`. Three ESM-crash-proof layers (§4.7).

### 3.7 ★ Article-level drafts + LinkedIn compression chain
Drafts are 800–1500-word structured articles (headers, code, takeaways), not
posts; a second model call compresses to a sub-3000-char LinkedIn update with
hook/spacing/hashtags/CTA rules and a server-side character count the UI shows
before copy. Two calls cost more; the quality gap justified it.

### 3.8 ★ Topic synthesis fallback
When the web yields < 3 items (or scoring yields < 3 ideas), Gemini synthesizes
from domain knowledge with 8–10 scores and doc-URL references. `/content` never
returns empty-handed; the tradeoff (ungrounded ideas) is contained by marking
provenance (`topicSearch` on every doc).

### 3.9 Webpack production builds
Turbopack's externalization crashed the auth chain on Linux (§4.7). `next build
--webpack` bundles through it. Cost: slower builds; revisit yearly. (An earlier
`serverExternalPackages: ["firebase-admin"]` attempt is now redundant but
harmless — remove it if touching config.)

### 3.10 No vector DB · no SDKs · copy-paste-first · manual stats
Unchanged from v1 (§3.4–3.9 of the original analysis): corpus fits in context,
plain `fetch` beats SDKs for public reads, LinkedIn shipped manual-first,
Dev.to alone has a free analytics API.

### 3.11 10/run + cursor pagination + maxed source caps
Bank pages at 20 via Firestore cursors (constant bandwidth, unbounded total);
runs score 10; sources run at API ceilings (GitHub 50, Bluesky/Mastodon 25,
HN search 25, SO 25, Dev.to 10/tag, RSS/YouTube uncapped, scoring input 100,
items view 200). A verified morning run drew 416 fetched → 387 unique.

## 4. Every production error (v2: resolutions added)

- **4.1 Hydration mismatch** — a Chrome extension's injected attributes, not our
  code. Incognito to verify; never mask `<html>`.
- **4.2 `CONFIGURATION_NOT_FOUND`** — Google provider disabled in console.
- **4.3 Multi-line `.env.local` paste** — dotenv is 1-D; squash programmatically,
  validate with `cert()`, never by eye.
- **4.4 Key-armor mangling** — pasted PEM lost its header/footer through chat
  transforms. Unrecoverable by tooling; fresh bytes via file path only.
- **4.5 Three model retirements** — one-line swaps each; `GROQ_MODEL` pattern
  should generalize to a registry + health checks.
- **4.6 Tailwind v4 `dark:` root cause** — `@custom-variant` one-liner; fix layers,
  not symptoms.
- **4.7 The `jose` ESM saga — RESOLVED.** Turbopack externalized
  `firebase-admin/auth`; `jwks-rsa` required ESM-only `jose` v6 (no CJS entry
  whatsoever); Node's require choked. Layered fix: webpack builds (bundle, don't
  externalize) + lazy-only auth import + REST verification fallback + cron via
  Firestore registry. Verified: prod ingest 200 + ideas 200 + digest sent.
- **4.8 Deploy sequence** — uncommitted components, Windows-only lockfile
  bindings (`lightningcss`, then `@tailwindcss/oxide` — same bug class twice),
  stale Node default. Rule: deploy sees pushed code only; lockfiles are
  platform-scoped unless forced.
- **4.9 Firestore/serverless limits** — 500-op batches → 400-chunks;
  `undefined` rejection → `cleanDoc`; 60s ceiling → `maxDuration` +
  force-dynamic + per-user/per-source isolation.
- **4.10 Secret transports** — service-account ×2, Gemini key, Telegram token
  all pasted in chat at some point; all rotated; workflow now file-paths only.
  Code never leaked (diag returns shapes, responses masked).
- **4.11 Parallel-edit collisions** — two authors, one tree: interleaved edits,
  a dropped line, a duplicated fetch, mystery diffs. Protocol that worked:
  verify with `git diff --stat` before every commit, stage only owned files,
  separate commits per author concern.
- **4.12 AGENTS.md flag — retracted.** Next.js 16 legitimately co-generates
  agent-rules files; the "prompt injection" call was wrong. Verify, then trust.

## 5. Improvements (v2: done items struck, new items added)

### P0 — Security (partially landed)
1. ~~AES-GCM at rest~~ DONE (with fail-closed key). Left: KMS envelope,
   per-user OAuth (kills 60-day LinkedIn refresh), rotation runbook for
   `ENCRYPTION_KEY` (current gap: rotate = re-save Settings; document it).
2. Set `TELEGRAM_WEBHOOK_SECRET` in prod (route enforces when present).
3. Restrict Google API keys (referrers + API scoping).

### P0 — Reliability
4. Upstash Redis rate limiting (replace per-instance memory, §3.5).
5. Cron chaining per user landed (ingest → score → digest split routes);
   watch 416-fetch runs against the 60s ceiling.
6. Idempotency keys on ideas/digests landed; keep them on every new sender.
7. `/topics` cooldown per chat (currently unbounded synchronous ~60s work).
8. Resolve `scripts/` — adopt as timeout-proof worker or delete (drift risk).

### P1 — Quality flywheel
9. **Own-writing corpus — BUILT** (`/corpus`, `/api/corpus*`, voice analyzer):
   Dev.to + RSS + manual + repo + LinkedIn CSV → gaps, follow-ups, repurposing.
   Remaining: scheduled re-analysis inside cron; calibration from publish
   performance (§5.11 in the original numbering).
10. Semantic near-duplicate collapsing (the URL-hash blind spot).
11. Scoring calibration from publish performance.
12. Eval set for topic→idea→draft, run on every model swap.
13. `decryptField` failure telemetry (silent `""` is a footgun during rotations).

### P1 — Hygiene
14. Tests: vitest (normalize/dedupe/chunking/crypto roundtrip/merge logic),
   Playwright smoke, provider contract tests.
15. CI on PR (lint+typecheck+build+tests) + preview deploys as gate.
16. Structured run logs + Sentry (console.error exists; aggregation doesn't).
17. Daily per-user LLM cost caps.

### P2 — Features
18. X threads · 19. LinkedIn image upload · 20. Medium import automation ·
21. Exa/Tavily deep research · 22. scheduling queue/calendar ·
23. newsletter repurposing chain.

## 6. Decision log (extends v1)

| Decision | Why | Cost if wrong |
|---|---|---|
| AES-GCM + masking + fail-closed | keys at rest, never over HTTP in plain | single server key; rotation = re-save |
| Server-side mutations | verified, rate-limited state changes | more routes to maintain |
| In-memory rate limits | cheap abuse friction now | doesn't bind serverless (Redis later) |
| Lazy auth + REST fallback | ESM chain unfixable otherwise | two verify paths to maintain |
| Users registry for cron | no Auth enumeration | profile write required on save |
| Article drafts + LinkedIn refine | quality gap justified 2 calls | token cost per draft |
| Topic synthesis fallback | never return empty | ungrounded ideas (marked) |
| Webpack prod | Turbopack externalization crash | slower builds |
| 10/run, cursors, max caps | unbounded bank, constant bandwidth | Gemini input capped at 100 |

## 7. How to extend (v2 notes)

- New source: `lib/ingest/<name>.ts` → `RawItem[]`, wire into `runIngest` and
  (if queryable) `searchTopics`; per-source try/catch mandatory. Reddit is the
  cautionary tale: verify server-side fetch before promising it.
- New model: one ID + env override, then the eval set (§5.12). Assume shelf life.
- New mutation: copy a `status` route (guard ladder + rate limit + zod body),
  never client-write state.
- New secrets flow: `enc:` on write, masked on read, `isMaskedSecret` merge on
  save, `ENCRYPTION_KEY` in every env. Test rotation, not just happy path.
- Debugging prod: `/api/diag` → function logs (real stacks) → local `next
  start` reproduction. Browser error text is a rumor; function logs are evidence.
