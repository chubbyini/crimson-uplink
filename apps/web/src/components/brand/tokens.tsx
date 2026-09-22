/**
 * Sojourner Builds — token family (pick 1 of 3 in /logo).
 *
 * - WAYMARK: angular S (always seeking) split by a forward path (always
 *   moving), ringed by a mech dial with three waypoint dots lighting in
 *   sequence — Lagos → Kaduna → Cross River.
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
    story: "No letterform — a long route winding through three weighted stations. Lagos smallest, Cross River full weight: where I am now. One thunder strike, one accent.",
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
@keyframes sj-breathe { 0%, 100% { opacity: 0.82; } 50% { opacity: 1; } }
.sj-spin { animation: sj-spin var(--sj-speed, 14s) linear infinite; transform-box: fill-box; transform-origin: center; }
.sj-spin-rev { animation: sj-spin-rev 30s linear infinite; transform-box: fill-box; transform-origin: center; }
.sj-wp { animation: sj-wp 3s ease-in-out infinite; }
.sj-breathe { animation: sj-breathe 5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .sj-spin, .sj-spin-rev, .sj-wp, .sj-breathe { animation: none; } }
`.trim();

export function SojournerToken({
  variant = "waymark",
  size = 96,
  spinning = true,
  speed = "normal",
  ring = "ticks",
  waypoints = true,
  glow = true,
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
      className={className}
      data-variant={variant}
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
          {/* Stark dial: hairline grey ring, sparse ticks, transparent ground. */}
          <g className={spin}>
            <circle cx="60" cy="60" r="52" fill="none" stroke={SJ_GREY} strokeWidth="1.5" strokeOpacity="0.9" />
            {ring === "ticks" &&
              Array.from({ length: 12 }, (_, i) => i * 2).map((t) => {
                const c = tickCoords(t);
                return (
                  <line
                    key={t}
                    x1={c.x1}
                    y1={c.y1}
                    x2={c.x2}
                    y2={c.y2}
                    stroke={c.major ? SJ_BONE : SJ_FAINT}
                    strokeOpacity={c.major ? 0.9 : 0.8}
                    strokeWidth={c.major ? 1.5 : 1}
                  />
                );
              })}
            {/* The long route: Lagos → Kaduna → Cross River, ending onward. */}
            <path
              d="M60 8 C 70 34, 92 46, 105 86 C 84 93, 38 93, 15 86"
              fill="none"
              stroke={SJ_BONE}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <polygon points="15,86 25,82 23.5,90.5" fill={SJ_BONE} />
            {waypoints && (
              <>
                {/* Lagos — origin, lightest. Kaduna — mid weight. Cross River — full weight: now. */}
                <circle cx="60" cy="8" r="1.8" fill="none" stroke={SJ_GREY} strokeWidth="1.2">
                  <title>Lagos</title>
                </circle>
                <circle cx="105" cy="86" r="3" fill={SJ_GREY}>
                  <title>Kaduna</title>
                </circle>
                <circle cx="15" cy="86" r="5.5" fill={SJ_BONE} className="sj-wp">
                  <title>Cross River — now</title>
                </circle>
              </>
            )}
          </g>
          {/* The thunder: the single accent strike across the route. */}
          <polygon
            points="74,24 58,54 66,54 46,90 58,60 50,60"
            fill={SJ_THUNDER}
          />
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
