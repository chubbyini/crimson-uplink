# Corpus Spec — own-writing import + gap/follow-up/repurpose analysis

*Status: SPEC (not built). Target: two commits (P1 auto+manual, P2 repo+CSV).*

## 1. Problem

The engine researches the world but doesn't know what *you* already wrote.
Result: repeat topics, missed follow-ups, and Dev.to articles never repurposed
to LinkedIn/X. The corpus fixes that: everything you've published becomes
queryable context for ideas.

## 2. Scope / non-scope

**In:** Dev.to import (keyed + public fallback), blog RSS import, manual
logging, LinkedIn CSV import, repo-markdown import, `/corpus` page, Gemini
gap/follow-up/repurpose analysis, adopt-to-idea buttons.
**Out:** vector DB/embeddings (list fits in context — same call as §3.4 of the
deep dive), automatic scheduled re-analysis (manual button first; cron later),
plagiarism detection, multi-author attribution.

## 3. Data model

```
users/{uid}/corpus/{hash}      ← one doc per piece
{
  title: string,               // required
  summary: string,             // ≤ 500 chars, auto-truncated
  tags: string[],              // devto tags / frontmatter tags / [] + optional manual
  url?: string,                // canonical link where it lives
  source: "devto" | "rss" | "repo" | "linkedin" | "manual",
  sourceId?: string,           // devto id / guid / repo path / csv row
  publishedAt?: string,
  importedAt: string,          // server now
}
users/{uid}/corpus-analysis/{autoId} ← one doc per analysis run
{
  createdAt: string,
  gaps: [{ topic, why }],
  followUps: [{ title, angle, basedOnUrl }],
  repurposes: [{ fromTitle, fromUrl, toFormat, angle }],
}
```

Dedupe: URL-hash doc IDs exactly like `storeItems` (same `urlHash`; title-hash
fallback `t:<sha16>` when no URL). Re-syncs are idempotent merges.

## 4. Settings additions (all optional, all BYOK-safe)

```ts
blogRssFeeds: string[]      // your blog/newsletter feeds (rss-parser, server)
writingRepo: string         // "owner/repo" for markdown posts (default "")
writingRepoPath: string     // subdir, e.g. "posts/" (default "")
```

No new secrets: Dev.to uses the existing `devtoKey`, repo reads use the
existing `githubToken`, LinkedIn CSV never leaves the browser unparsed
(client parses → POSTs pieces).

## 5. Import sources

| Source | How | Key? | Notes |
|---|---|---|---|
| Dev.to | `GET /api/articles/me?per_page=100` (keyed: +views) → fallback public `?username=` | devtoKey or none | title/description/tags/canonical/published |
| Blog RSS | `rss-parser` over `blogRssFeeds` | none | summary = contentSnippet ≤500 chars |
| Repo markdown | GitHub contents API (`fetch`, token header) → tree → `.md` files under path → `gray-matter` frontmatter (title/tags/date) + body slice | githubToken | NEW DEP: `gray-matter` only |
| LinkedIn export | Client-side CSV parse (Posts.csv: content + date columns) → manual-piece POSTs | none | Parsing in browser; server never sees the file |
| Manual | Form on `/corpus` (title/summary/tags/url) | none | Covers everything else, zero fragility |

## 6. API contracts

**POST /api/corpus/sync** (ID token) → runs Dev.to + RSS + repo pulls,
dedupe-stores, returns `{devto, rss, repo, added, total}`.
Errors per source (one dead feed never kills the run — house rule).

**POST /api/corpus** (ID token) body `{pieces: [{title, summary?, tags?, url?, source}]}` →
validates (zod, title required, caps: 200 pieces/call, summary ≤2000 chars in)
→ stores with title/URL-hash IDs → returns `{added, skipped}`.
Serves manual form + LinkedIn CSV import.

**POST /api/corpus/analyze** (ID token) → reads corpus (cap 100, newest first)
+ 20 newest bank ideas → Gemini `generateObject` (IdeasSchema-style zod:
`{gaps[], followUps[], repurposes[]}`, max 5 each) → stores analysis doc →
returns it. Requires `geminiKey`; 502 surfaces provider errors verbatim.

**Adopt-to-idea:** client-side Firestore write (owner rules already allow)
from the analysis card → `ideas/{autoId}` `{title, angle, format, sourceUrls:
[basedOnUrl], status: "new"}`. No route needed; keeps the loop closed in one tap.

## 7. UI (`/corpus` page + nav)

- Header stats: pieces count by source.
- **Sync now** button → per-source counts line.
- **Manual add** form (title/summary/tags/url) → POST /api/corpus.
- **LinkedIn CSV import**: file input → client parse → preview count → POST.
- **Analyze** button → results in three sections (Gaps / Follow-ups /
  Repurpose), each card with an **Adopt** button (writes the idea, marks card
  adopted locally).
- Nav: 7th link CORPUS (mobile dropdown is a vertical list — no grid change;
  desktop nav gains one item).
- Auth gate identical to other pages (bounce to `/` when signed out).

## 8. Gemini prompts (anchored, not freeform)

- Analysis system: "You are an editor auditing a developer's body of work
  against fresh ideas. Gaps = topics in ideas with no corpus coverage.
  Follow-ups = corpus pieces with obvious part-twos. Repurposes = devto pieces
  with a linkedin/x angle. Concrete angles only, never generic."
- Input: corpus lines `[title | tags | url]` (≤100) + idea lines. Output schema
  capped at 5/section (token discipline).

## 9. Limits & failure modes

- 100-piece analysis cap (newest first); corpus itself unbounded, paged at 20
  like the bank.
- Repo import caps at 200 files/run (tree pagination later if needed).
- CSV parsing is best-effort: unknown columns → row skipped with a count, never
  a 500. LinkedIn changes export formats; the manual form is the backstop.
- `gray-matter` is the only new dependency.

## 10. Acceptance criteria

1. `/corpus` lists Dev.to articles after Sync (title/tags/link correct).
2. Re-sync adds zero duplicates (`added: 0`, counts stable).
3. Manual + CSV pieces appear with `manual`/`linkedin` source chips.
4. Analyze returns 3 sections, each card Adopts into `/ideas` as `new`.
5. No Gemini/Groq key → clear 400s naming the missing key (house guard ladder).
6. Lint + webpack build green; no new untracked files left behind.

## 11. Phases

- **P1 (this build):** Dev.to + RSS + manual + page + analyze + adopt.
- **P2:** repo markdown (`gray-matter`) + LinkedIn CSV import.
- **P3 (later):** monthly re-analysis inside cron; calibration (§5.11 deep dive)
  consuming publish performance.
