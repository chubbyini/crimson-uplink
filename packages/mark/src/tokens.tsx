/**
 * Sojourner Builds — token family (pick 1 of 3 in /logo).
 *
 * - WAYMARK: clock-style nautical compass dial (flat, no bloom) ringed by
 *   N/NE/E/SE/S/SW/W/NW markings. The dial turns clockwise while a real
 *   side-view ship sails the ring counter-clockwise, dragging a flat wake.
 *   Lagos → Kaduna → Cross River ports are joined by an off-white route
 *   line. All paint rides theme vars (--sj-ink/dim/faint/wake/strike/ship)
 *   so it reads in both dark and light mode. No glow, no blur, no lightning.
 * - MONOGRAM: fused SB mark on a shared spine, pushed onward by a cyan
 *   double-chevron. Cleaner, more corporate.
 * - COMPASS: traveller's compass rose, needle locked forward, cardinal ring.
 *
 * PORTABLE BY DESIGN: pure SVG + props, no app imports. Pair with
 * PORTABLE_CSS below (same rules as globals.css sj-* classes) to drop the
 * winner into any project.
 */

export type SojournerVariant = "waymark" | "monogram" | "compass";
export type SojournerSpeed = "slow" | "normal" | "fast";
export type SojournerRing = "ticks" | "solid" | "none";

/** Stark palette: off-white line, mid-grey secondary, transparent ground. */
export const SJ_BONE = "#e8e6e1";
export const SJ_GREY = "#8a8f98";
export const SJ_FAINT = "#5b6068";
/** The single accent: thunder blue. */
export const SJ_THUNDER = "#38bdf8";

export const SOJOURNER_VARIANTS: Array<{
  id: SojournerVariant;
  name: string;
  story: string;
}> = [
  {
    id: "waymark",
    name: "Waymark",
    story: "A clock-style nautical dial turning clockwise while a real ship sails the ring counter-clockwise. Lagos → Kaduna → Cross River route, flat black wake in light mode. Dark/light aware. No glow, no blur, no lightning.",
  },
  {
    id: "monogram",
    name: "Monogram",
    story: "SB fused on one spine and shoved forward by a double-chevron. The corporate mark.",
  },
  {
    id: "compass",
    name: "Compass",
    story: "A traveller's rose with the needle locked forward. Pure journey symbolism.",
  },
];

export interface SojournerTokenProps {
  variant?: SojournerVariant;
  size?: number;
  spinning?: boolean;
  speed?: SojournerSpeed;
  ring?: SojournerRing;
  waypoints?: boolean;
  glow?: boolean;
  /** Palette lock. "auto" follows the page (OS scheme unless pinned dark);
      "dark"/"light" force it — use "dark" on dark backdrops like the veil. */
  theme?: "auto" | "dark" | "light";
  title?: string;
  className?: string;
}

const SPEED_MS: Record<SojournerSpeed, string> = {
  slow: "26s",
  normal: "14s",
  fast: "6s",
};

const TICKS = Array.from({ length: 24 }, (_, i) => i);

function tickCoords(i: number): { x1: number; y1: number; x2: number; y2: number; major: boolean } {
  const major = i % 6 === 0;
  const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
  const r1 = major ? 41 : 44;
  const r2 = 48;
  return {
    x1: 60 + r1 * Math.cos(a),
    y1: 60 + r1 * Math.sin(a),
    x2: 60 + r2 * Math.cos(a),
    y2: 60 + r2 * Math.sin(a),
    major,
  };
}

/** Self-contained CSS for the token (mirrors globals.css sj-* rules). */
export const PORTABLE_CSS = `
@keyframes sj-spin { to { transform: rotate(360deg); } }
@keyframes sj-spin-rev { to { transform: rotate(-360deg); } }
@keyframes sj-wp { 0%, 100% { opacity: 0.22; } 12% { opacity: 1; } 32% { opacity: 0.45; } }
@keyframes sj-strike { 0%, 100% { opacity: 1; } 3% { opacity: 0.35; } 5% { opacity: 1; } 7% { opacity: 0.6; } 9% { opacity: 1; } 55% { opacity: 1; } 57% { opacity: 0.5; } 59% { opacity: 1; } }
@keyframes sj-breathe { 0%, 100% { opacity: 0.82; } 50% { opacity: 1; } }
.sj-spin { animation: sj-spin var(--sj-speed, 14s) linear infinite; transform-box: fill-box; transform-origin: center; }
.sj-spin-rev { animation: sj-spin-rev 30s linear infinite; transform-box: fill-box; transform-origin: center; }
.sj-orbit-rev { animation: sj-spin-rev var(--sj-speed, 14s) linear infinite; transform-box: view-box; transform-origin: center; }
.sj-token { --sj-ink: #e8e6e1; --sj-dim: #8a8f98; --sj-faint: #5b6068; --sj-deep: #0b0f1a; --sj-wake: #e8e6e1; --sj-strike: #38bdf8; --sj-ship: #e8e6e1; }
.sj-token[data-sj-theme="dark"] { --sj-ink: #e8e6e1; --sj-dim: #8a8f98; --sj-faint: #5b6068; --sj-deep: #0b0f1a; --sj-wake: #e8e6e1; --sj-strike: #38bdf8; --sj-ship: #e8e6e1; }
@media (prefers-color-scheme: light) { :root:not(.dark) .sj-token:not([data-sj-theme]) { --sj-ink: #17202e; --sj-dim: #475569; --sj-faint: #94a3b8; --sj-deep: #f1f5f9; --sj-wake: #000; --sj-strike: #0284c7; --sj-ship: #000; } }
.sj-token[data-sj-theme="light"] { --sj-ink: #17202e; --sj-dim: #475569; --sj-faint: #94a3b8; --sj-deep: #f1f5f9; --sj-wake: #000; --sj-strike: #0284c7; --sj-ship: #000; }
.sj-f-ink { fill: var(--sj-ink); } .sj-f-dim { fill: var(--sj-dim); } .sj-f-faint { fill: var(--sj-faint); } .sj-f-deep { fill: var(--sj-deep); } .sj-f-strike { fill: var(--sj-strike); } .sj-f-ship { fill: var(--sj-ship); }
.sj-s-ink { stroke: var(--sj-ink); } .sj-s-dim { stroke: var(--sj-dim); } .sj-s-faint { stroke: var(--sj-faint); } .sj-s-deep { stroke: var(--sj-deep); } .sj-s-strike { stroke: var(--sj-strike); } .sj-s-wake { stroke: var(--sj-wake); } .sj-s-ship { stroke: var(--sj-ship); }
.sj-wp { animation: sj-wp 3s ease-in-out infinite; }
.sj-strike { animation: sj-strike 4.2s linear infinite; }
.sj-breathe { animation: sj-breathe 5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .sj-spin, .sj-spin-rev, .sj-orbit-rev, .sj-wp, .sj-strike, .sj-breathe { animation: none; } }
`.trim();

export function SojournerToken({
  variant = "waymark",
  size = 96,
  spinning = true,
  speed = "normal",
  ring = "ticks",
  waypoints = true,
  glow = true,
  theme = "auto",
  title = "Sojourner Builds mark",
  className,
}: SojournerTokenProps) {
  const spin = spinning ? "sj-spin" : undefined;
  const glowFilter = glow ? "url(#sj-glow)" : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
      className={className ? `sj-token ${className}` : "sj-token"}
      data-variant={variant}
      data-sj-theme={theme === "auto" ? undefined : theme}
      style={spinning ? ({ "--sj-speed": SPEED_MS[speed] } as React.CSSProperties) : undefined}
    >
      <defs>
        <linearGradient id="sj-crimson" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff5c7a" />
          <stop offset="55%" stopColor="#ff2a55" />
          <stop offset="100%" stopColor="#8f1030" />
        </linearGradient>
        <radialGradient id="sj-core" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0%" stopColor="#ff2a55" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff2a55" stopOpacity="0" />
        </radialGradient>
        <filter id="sj-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {variant !== "waymark" && glow && <circle cx="60" cy="60" r="46" fill="url(#sj-core)" />}

      {variant !== "waymark" ? (
        <>
          {/* Outer dial: faint counter-spinning orbit + main ring + ticks. */}
          <circle
            cx="60"
            cy="60"
            r="57"
            fill="none"
            stroke="#ff2a55"
            strokeOpacity="0.28"
            strokeWidth="1"
            strokeDasharray="3 7"
            className={spinning ? "sj-spin-rev" : undefined}
          />
          <g className={spin}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="url(#sj-crimson)" strokeWidth="4" strokeOpacity="0.92" />
            {ring === "ticks" &&
              TICKS.map((i) => {
                const t = tickCoords(i);
                return (
                  <line
                    key={i}
                    x1={t.x1}
                    y1={t.y1}
                    x2={t.x2}
                    y2={t.y2}
                    stroke="#ff5c7a"
                    strokeOpacity={t.major ? 0.95 : 0.5}
                    strokeWidth={t.major ? 2.2 : 1.2}
                  />
                );
              })}
            {variant === "compass" &&
              ["N", "E", "S", "W"].map((c, i) => {
                const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
                return (
                  <text
                    key={c}
                    x={60 + 44 * Math.cos(a)}
                    y={60 + 44 * Math.sin(a)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="7"
                    fontFamily="monospace"
                    fill={c === "N" ? "#ff5c7a" : "#64748b"}
                  >
                    {c}
                  </text>
                );
              })}
          </g>
        </>
      ) : (
        <>
          {/* WAYMARK — clock-style nautical dial (ALL FLAT: no glow, no
              blur) turning clockwise, while the ship sails the ring
              counter-clockwise dragging a flat theme-aware wake. */}
          {/* Dial: flat hairline ring, nautical degree ticks, 8-wind
              markings, flat centre rose. Spins opposite the ship. */}
          <g className={spin}>
            {ring !== "none" && (
              <>
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="1.5" strokeOpacity="0.9" className="sj-s-dim" />
                <circle cx="60" cy="60" r="38" fill="none" strokeWidth="0.75" strokeOpacity="0.7" className="sj-s-faint" />
              </>
            )}
            {ring === "ticks" &&
              Array.from({ length: 72 }, (_, i) => {
                const deg = i * 5;
                const a = ((deg - 90) * Math.PI) / 180;
                const principal = i % 9 === 0; // every 45° — the 8 winds
                const medium = i % 3 === 0; // every 15°
                const r1 = principal ? 40 : medium ? 43 : 45.5;
                const r2 = 48;
                return (
                  <line
                    key={i}
                    x1={60 + r1 * Math.cos(a)}
                    y1={60 + r1 * Math.sin(a)}
                    x2={60 + r2 * Math.cos(a)}
                    y2={60 + r2 * Math.sin(a)}
                    className={principal ? "sj-s-ink" : "sj-s-faint"}
                    strokeOpacity={principal ? 0.95 : medium ? 0.7 : 0.45}
                    strokeWidth={principal ? 1.6 : medium ? 1 : 0.7}
                  />
                );
              })}
            {/* Nautical 8-wind markings — never clock numerals. */}
            {(
              [
                { p: "N", deg: 0, major: true },
                { p: "NE", deg: 45, major: false },
                { p: "E", deg: 90, major: true },
                { p: "SE", deg: 135, major: false },
                { p: "S", deg: 180, major: true },
                { p: "SW", deg: 225, major: false },
                { p: "W", deg: 270, major: true },
                { p: "NW", deg: 315, major: false },
              ] as const
            ).map(({ p, deg, major }) => {
              const a = ((deg - 90) * Math.PI) / 180;
              const r = major ? 30 : 30;
              return (
                <text
                  key={p}
                  x={60 + r * Math.cos(a)}
                  y={60 + r * Math.sin(a)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={major ? 8 : 5.5}
                  fontWeight={major ? 700 : 400}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  className={major ? "sj-f-ink" : "sj-f-dim"}
                  opacity={major ? 1 : 0.85}
                >
                  {p}
                </text>
              );
            })}
            {/* Flat 4-point centre rose — bone/grey, no filter, no bloom. */}
            <g opacity="0.55">
              <polygon points="60,46 62,58 60,70 58,58" className="sj-f-ink" />
              <polygon points="60,50 61,58 60,66 59,58" className="sj-f-faint" />
              <polygon points="74,60 62,62 50,60 62,58" className="sj-f-ink" opacity="0.6" />
              <polygon points="46,60 58,61.5 74,60 58,58.5" className="sj-f-faint" opacity="0.7" />
              <circle cx="60" cy="60" r="2" className="sj-f-ink" />
            </g>
            {waypoints && (
              <>
                {/* Lagos → Kaduna → Cross River, joined by an off-white
                    route line along the ring. Travels with the dial. */}
                <path
                  d="M23.2 96.8 A52 52 0 0 0 96.8 96.8"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="sj-s-ink"
                />
                <circle cx="23.2" cy="96.8" r="1.8" fill="none" strokeWidth="1.2" className="sj-s-dim">
                  <title>Lagos</title>
                </circle>
                <circle cx="96.8" cy="96.8" r="3" className="sj-f-dim">
                  <title>Kaduna</title>
                </circle>
                <circle cx="60" cy="112" r="4" className="sj-f-ink sj-wp">
                  <title>Cross River — now</title>
                </circle>
              </>
            )}
          </g>
          {/* The voyage: ship + wake orbit counter-clockwise
              (opposite clock direction) around the dial centre. */}
          <g className={spinning ? "sj-orbit-rev" : undefined}>
            {/* Wake — flat single line, trailing clockwise behind the CCW
                ship. Black in light mode, off-white in dark so it survives
                the dark veil. */}
            <path
              d="M60 8 A52 52 0 0 1 111.2 51"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              className="sj-s-wake"
            />
            {/* Real ship, side view, bow pointing −x = direction of
                counter-clockwise travel at the top of the dial. It rides ON
                the ring (translate 60 8); the parent orbit carries it round.
                Hull + sails flat bone/grey — no bloom on the ship. */}
            <g transform="translate(60 8)">
              {/* bowsprit */}
              <line x1="-10" y1="0" x2="-15" y2="-4" strokeWidth="1" strokeLinecap="round" className="sj-s-ship" />
              <line x1="-15" y1="-4" x2="5" y2="-11" strokeWidth="0.7" strokeOpacity="0.9" className="sj-s-faint" />
              {/* hull + gunwale — flat */}
              <path d="M-11 0 H11 L7 6 H-7 Z" strokeWidth="0.8" strokeLinejoin="round" className="sj-f-ship sj-s-deep" />
              <rect x="-11" y="-1.4" width="22" height="1.6" className="sj-f-ship" />
              {/* stern cabin */}
              <rect x="6" y="-4.2" width="4" height="3" strokeWidth="0.4" className="sj-f-dim sj-s-deep" />
              {/* masts — flat, thickened to read at small sizes */}
              <line x1="-3" y1="-1" x2="-3" y2="-13" strokeWidth="1.5" strokeLinecap="round" className="sj-s-ship" />
              <line x1="5" y1="-1" x2="5" y2="-11" strokeWidth="1.4" strokeLinecap="round" className="sj-s-ship" />
              {/* square sails — flat, deep edge for definition */}
              <path d="M-8.5 -13 H2.5 L1 -3 H-7.5 Z" opacity="0.95" strokeWidth="0.5" strokeLinejoin="round" className="sj-f-ship sj-s-deep" />
              <path d="M2 -11 H9 L8 -3 H3 Z" strokeWidth="0.5" strokeLinejoin="round" className="sj-f-dim sj-s-deep" />
              {/* sail seams — flat */}
              <line x1="-8" y1="-8" x2="2" y2="-8" strokeWidth="0.5" strokeOpacity="0.8" className="sj-s-faint" />
              {/* ensign — flat strike colour, the ship's colour pop */}
              <polygon points="-3,-13 -8,-11.5 -3,-10" className="sj-f-strike" />
              {/* portholes — flat contrast dots */}
              <circle cx="-4" cy="3" r="0.8" className="sj-f-deep" />
              <circle cx="0" cy="3" r="0.8" className="sj-f-deep" />
              <circle cx="4" cy="3" r="0.8" className="sj-f-deep" />
            </g>
          </g>
        </>
      )}

      {variant === "monogram" && (
        <>
          {/* Shared spine + fused SB, shoved forward by a double chevron. */}
          <g filter={glowFilter}>
            <rect x="36" y="34" width="8" height="52" fill="url(#sj-crimson)" />
            <path
              d="M78 40 H48 V48 H70 L76 54 V56 H48"
              fill="none"
              stroke="url(#sj-crimson)"
              strokeWidth="7"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <path
              d="M48 64 H68 L78 70 L68 76 H48 L74 76"
              fill="none"
              stroke="url(#sj-crimson)"
              strokeWidth="7"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <polyline points="84,58 92,66 84,74" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="92,58 100,66 92,74" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
          </g>
        </>
      )}

      {variant === "compass" && (
        <>
          {/* Traveller's rose, needle locked forward (up). */}
          <g className={spinning ? "sj-breathe" : undefined}>
            <polygon
              points="60,24 66,54 96,60 66,66 60,96 54,66 24,60 54,54"
              fill="url(#sj-crimson)"
              filter={glowFilter}
            />
            <polygon points="60,42 63,57 78,60 63,63 60,78 57,63 42,60 57,57" fill="#0b0f1a" opacity="0.85" />
          </g>
          <g filter={glowFilter}>
            <line x1="60" y1="76" x2="60" y2="30" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
            <polygon points="60,22 65,32 55,32" fill="#38bdf8" />
            <circle cx="60" cy="60" r="4.5" fill="#38bdf8" />
            <circle cx="60" cy="60" r="2" fill="#0b0f1a" />
          </g>
        </>
      )}
    </svg>
  );
}
