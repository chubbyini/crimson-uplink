# @sojournerbuilds/mark

Sojourner Builds waymark — a nautical compass token with a ship sailing the ring counter-clockwise. Pure SVG + CSS. Zero runtime dependencies. React 18+.

- **`/tokens`** — the `SojournerToken` mark (waymark, monogram, compass). Works in any React app.
- **`/loader`** — the full-screen `SojournerLoader` veil. No Tailwind needed.
- **`/next`** — `SojournerVeilProvider` + data-aware veil (`track` / `trackAll` / `<SojournerRelease />`). Requires Next.js.

---

## 1. Install

```bash
npm install @sojournerbuilds/mark
```

```tsx
import "@sojournerbuilds/mark/token.css";
import { SojournerToken } from "@sojournerbuilds/mark/tokens";

<SojournerToken size={128} />;
```

> The two CSS files must be imported once, at your app entry (or root layout in Next.js). Without `token.css` the mark renders unstyled and static.

---

## 2. The token

### Basic usage

```tsx
import { SojournerToken } from "@sojournerbuilds/mark/tokens";

// Tab spinner / button / empty state
<SojournerToken size={32} spinning={false} />

// Hero / loading veil
<SojournerToken size={128} speed="slow" />

// Forced light palette on a light card
<SojournerToken size={64} theme="light" />
```

### Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| `variant` | `"waymark" \| "monogram" \| "compass"` | `"waymark"` | Which mark to render. |
| `size` | `number` | `96` | Width/height in px. The SVG scales cleanly to any size. |
| `spinning` | `boolean` | `true` | Animate. Honors `prefers-reduced-motion` (freezes when set). |
| `speed` | `"slow" \| "normal" \| "fast"` | `"normal"` | Orbit speed: 26s / 14s / 6s per revolution. |
| `ring` | `"ticks" \| "solid" \| "none"` | `"ticks"` | Dial furniture. `ticks` = nautical degree ring, `solid` = bare rings, `none` = ship + labels only. |
| `waypoints` | `boolean` | `true` | Lagos → Kaduna → Cross River ports + the off-white route line (waymark only). |
| `glow` | `boolean` | `true` | Reserved for monogram/compass accents. Waymark is always flat. |
| `theme` | `"auto" \| "dark" \| "light"` | `"auto"` | Palette lock (see §5). |
| `title` | `string` | `"Sojourner Builds mark"` | Accessible label (`aria-label` on the SVG). |
| `className` | `string` | — | Merged alongside the internal `sj-token` scope class. |

### The three variants

- **waymark** (default) — clock-style nautical dial (N/NE/E/SE/S/SW/W/NW, degree ticks) turning clockwise while a side-view ship sails the ring counter-clockwise with a flat wake. Lagos → Kaduna → Cross River route along the ring. No glow, no blur.
- **monogram** — fused SB on a spine, shoved forward by a cyan double-chevron. Corporate.
- **compass** — traveller's rose, needle locked forward, cardinal ring.

`SOJOURNER_VARIANTS` (exported from `/tokens`) lists each id with its one-line story — useful for building your own picker UI.

### Non-React / no-build usage

`PORTABLE_CSS` (exported from `/tokens`) plus any rendered `<svg>` element's `outerHTML` is the entire token. Paste both into any HTML page, CMS, or email-safe static export — no npm, no JS framework:

```html
<style>/* PORTABLE_CSS contents */</style>
<!-- pasted <svg>…</svg> -->
```

---

## 3. The loader veil

Full-screen loading overlay. Works in **any** React app (Vite, CRA, Remix, plain React) — styled by `veil.css`, no Tailwind required.

```tsx
import "@sojournerbuilds/mark/token.css";
import "@sojournerbuilds/mark/veil.css";
import { SojournerLoader } from "@sojournerbuilds/mark/loader";

function Checkout() {
  const [busy, setBusy] = useState(false);
  return (
    <>
      {busy && <SojournerLoader label="Confirming payment…" />}
      {/* … */}
    </>
  );
}
```

| Prop | Type | Default | What it does |
|---|---|---|---|
| `label` | `string` | rotating lines (`Seeking knowledge…` / `Moving forward…` / `Knowledge never ends…`) | Status line under the mark. |
| `variant` | `"waymark" \| "monogram" \| "compass"` | `"waymark"` | Which mark to show. |

The veil backdrop is always dark (`#05070d`), and the token inside is locked to `theme="dark"` to match — it can never wash out.

---

## 4. The Next.js route veil

Auto-covers route transitions **and** data loading. Import from the dedicated entry (the only piece that touches `next/navigation`):

```tsx
// app/layout.tsx
import { SojournerVeilProvider } from "@sojournerbuilds/mark/next";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SojournerVeilProvider>{children}</SojournerVeilProvider>
      </body>
    </html>
  );
}
```

### Coverage model

All three modes below feed one pending-counter. The veil lifts when the **last** hold clears.

| Page type | What you write | Veil covers |
|---|---|---|
| Static / fast server page | nothing | brief flash on navigation |
| Slow server page | `<SojournerRelease />` as the last element | link click → streamed content hydrated |
| Client-fetch dashboard | `veil.track(promise)` or `veil.trackAll([...])` | mount → all awaits settled |
| Anything else | `const done = veil.show()` … `done()` | manual hold |

### 4a. Client fetches — `track` / `trackAll`

```tsx
"use client";
import { useEffect, useState } from "react";
import { useSojournerVeil } from "@sojournerbuilds/mark/next";

export default function AnalyticsPage() {
  const { track } = useSojournerVeil();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Lifts when the fetch settles — fulfilled OR rejected.
    // Rejections still reach your own .catch/toast; the veil never swallows errors.
    void track(
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setStats)
        .catch((e) => toast.error(e.message))
    );
  }, [track]);

  // …
}
```

Dashboard with parallel loads — lifts only when **all** settle:

```tsx
useEffect(() => {
  void veil.trackAll([loadIdeas(), loadDrafts(), loadStats()]);
}, [veil.trackAll]);
```

- `track` is idempotent per promise object, so React StrictMode double-effects can't double-count or leak.
- `show()` now returns a release function for non-promise work:
  ```tsx
  const done = veil.show();
  try {
    await longTask();
  } finally {
    done();
  }
  ```

### 4b. Slow server pages — `<SojournerRelease />`

A client marker you drop as the **last element** of a server component. Components hydrate in stream order, so it mounts only after everything above it has arrived — the veil then spans the full server await instead of a timed guess. Pages without it behave exactly as before (zero cost, zero changes).

```tsx
// app/analytics/page.tsx — server component
import { SojournerRelease } from "@sojournerbuilds/mark/next";

export default async function AnalyticsPage() {
  const stats = await getStats(); // slow server await
  return (
    <main>
      <Dashboard stats={stats} />
      <SojournerRelease />
    </main>
  );
}
```

### 4c. Automatic link coverage

Same-origin `<Link>`/`<a>` clicks start coverage for the outgoing page (`coverNavigations`, default on). Opt individual links out:

```tsx
<Link href="/settings" data-sj-noveil>Quick settings</Link>
```

Modifier-clicks, new-tab targets, downloads, external URLs, and `#anchors` are ignored automatically. Programmatic `router.push()` without a click won't trigger it — call `show()`/`track()` explicitly there.

### 4d. Provider props

```tsx
<SojournerVeilProvider
  variant="waymark"      // hardwire a mark (default: read local pick, live-updates)
  coverNavigations       // default true
  trackTimeoutMs={30000} // cap for tracked-fetch holds (default 30000)
  settleMs={900}         // streaming bridge window for <SojournerRelease /> (default 900)
  label="Syncing…"       // loading line (default: rotating lines)
/>
```

### 4e. Timing guarantees

- **Minimum 600ms showcase** — short loads read as intentional, never a flicker.
- **Safety caps** — 5s for flashes, `trackTimeoutMs` for tracked loads. A hung request can never stick the veil.
- **Stale-page cleanup** — navigating away clears the previous page's holds; in-flight promises release harmlessly when they settle.

### 4f. When NOT to use it

Pages rendered as server components with instant data don't need anything — and if you already use `loading.tsx`, that's route-level Suspense doing the same job. `track` is specifically for **client-side fetching after mount**; `<SojournerRelease />` is for **slow server awaits**. Use either, both (they compose — last hold wins), or neither.

---

## 5. Theming (dark / light)

All paint rides CSS variables scoped to `.sj-token`:

| Variable | Dark | Light | Used by |
|---|---|---|---|
| `--sj-ink` | `#e8e6e1` bone | `#17202e` slate | route, labels, ticks |
| `--sj-dim` | `#8a8f98` | `#475569` | ring, shaded sail, cabin |
| `--sj-faint` | `#5b6068` | `#94a3b8` | minor ticks, seams |
| `--sj-deep` | `#0b0f1a` | `#f1f5f9` | portholes, silhouette edges |
| `--sj-ship` | `#e8e6e1` | `#000` black | hull, sails, masts |
| `--sj-wake` | `#e8e6e1` | `#000` black | wake trail |
| `--sj-strike` | `#38bdf8` | `#0284c7` | ensign pennant |

- `theme="auto"` (default): dark palette, flipping to light only where the page itself isn't pinned dark — so a dark-slate ship never renders on a dark panel.
- `theme="dark"` / `"light"`: hard lock via `data-sj-theme`. Use `"dark"` on any dark backdrop (the loader veil does this internally).

---

## 6. Full examples

### Vite + React

```tsx
// src/main.tsx
import "@sojournerbuilds/mark/token.css";
import "@sojournerbuilds/mark/veil.css";

// src/App.tsx
import { useState } from "react";
import { SojournerToken, SojournerLoader } from "@sojournerbuilds/mark";

export default function App() {
  const [busy, setBusy] = useState(false);
  return (
    <header>
      <SojournerToken size={28} spinning={false} />
      {busy && <SojournerLoader label="Working…" />}
    </header>
  );
}
```

### Next.js App Router (everything)

```tsx
// app/layout.tsx
import "@sojournerbuilds/mark/token.css";
import "@sojournerbuilds/mark/veil.css";
import { SojournerVeilProvider } from "@sojournerbuilds/mark/next";
import { SojournerToken } from "@sojournerbuilds/mark/tokens";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SojournerVeilProvider>
          <nav>
            <SojournerToken size={28} spinning={false} />
          </nav>
          {children}
        </SojournerVeilProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/dashboard/page.tsx — server shell + client widgets (both holds)
import { SojournerRelease } from "@sojournerbuilds/mark/next";

export default async function DashboardPage() {
  const header = await getHeader(); // covered by the marker below
  return (
    <main>
      <Header data={header} />
      <ClientWidgets /> {/* internally veil.track(fetch…) */}
      <SojournerRelease />
    </main>
  );
}
```

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Mark renders but doesn't animate | `token.css` not imported, or `spinning={false}` | Import the CSS once at app entry; check the prop. |
| Ship/labels invisible on dark background | Page forces light palette (OS `prefers-color-scheme: light` without a pinned-dark root) | Pass `theme="dark"`, or pin your app dark. |
| Black wake invisible | Black-on-black: dark backdrop + light palette | Intended — wake is black only in light mode; check `theme`. |
| Veil never appears on fetch | `track()` called outside the provider, or on a `void`'d non-promise | Call inside a component under `SojournerVeilProvider`; pass a real promise. |
| Veil sticks | A raw `show()` without matching release, or fetch never settling | Prefer `track()` (auto-release); caps (5s/30s) guarantee it still lifts. |
| `data-sj-noveil` ignored | Attribute on a wrapper, not the `<a>` | Put it directly on the link element. |
| TS: `next/navigation` not found | Imported `/next` in a non-Next app | Use `/tokens` + `/loader` only; `/next` requires Next.js. |

---

## 8. Constants & escape hatches

```tsx
import {
  SJ_BONE, SJ_GREY, SJ_FAINT, SJ_THUNDER, // raw palette
  SOJOURNER_VARIANTS,                     // [{ id, name, story }] for picker UIs
  PORTABLE_CSS,                           // standalone CSS string (no-build use)
  SOJOURNER_PICK_KEY, PICK_EVENT,          // /next: local variant-pick channel
  NOVEIL_ATTR,                            // /next: "data-sj-noveil"
} from "@sojournerbuilds/mark/tokens";
```

License: MIT.
