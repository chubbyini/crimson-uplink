/**
 * Sojourner Builds — WAYMARK token.
 *
 * A traveller's mark: an angular S (always seeking) split by a forward path
 * (always moving), ringed by a mech dial carrying three waypoint dots that
 * light in sequence — Lagos → Kaduna → Cross River. The spin IS the journey;
 * the lighting waypoints are knowledge collected along the way.
 *
 * PORTABLE BY DESIGN: pure SVG + props, no app imports. Pair with
 * PORTABLE_CSS below (same rules as globals.css sj-* classes) to drop this
 * into any project: `<style>{PORTABLE_CSS}</style>` + the rendered `<svg>`.
 */

export type SojournerSpeed = "slow" | "normal" | "fast";
export type SojournerRing = "ticks" | "solid" | "none";

export interface SojournerTokenProps {
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
// Waypoint stations: top (Lagos), lower-right (Kaduna), lower-left (Cross River).
const WAYPOINTS = [
  { x: 60, y: 8, delay: "0s", label: "Lagos" },
  { x: 105.0, y: 86, delay: "1s", label: "Kaduna" },
  { x: 15.0, y: 86, delay: "2s", label: "Cross River" },
];

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
  size = 96,
  spinning = true,
  speed = "normal",
  ring = "ticks",
  waypoints = true,
  glow = true,
  title = "Sojourner Builds waymark",
  className,
}: SojournerTokenProps) {
  const spin = spinning ? "sj-spin" : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
      className={className}
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

      {glow && <circle cx="60" cy="60" r="46" fill="url(#sj-core)" />}

      {/* Outer dial: faint orbit (counter-spin) + main ring + ticks (spin). */}
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
        {waypoints &&
          WAYPOINTS.map((w) => (
            <g key={w.label}>
              <title>{w.label}</title>
              <circle cx={w.x} cy={w.y} r="6.5" fill="none" stroke="#ff2a55" strokeOpacity="0.5" strokeWidth="1" />
              <circle
                cx={w.x}
                cy={w.y}
                r="3.2"
                fill="#ff5c7a"
                filter="url(#sj-glow)"
                className="sj-wp"
                style={{ animationDelay: w.delay }}
              />
            </g>
          ))}
      </g>

      {/* The S: angular, always seeking. */}
      <g className={spinning ? "sj-breathe" : undefined}>
        <path
          d="M80 42 H46 Q39 42 39 49 L39 53 Q39 60 47 60 H73 Q81 60 81 68 L81 72 Q81 80 73 80 H44"
          fill="none"
          stroke="url(#sj-crimson)"
          strokeWidth="9"
          strokeLinecap="square"
          filter={glow ? "url(#sj-glow)" : undefined}
        />
      </g>

      {/* The forward path: kinked momentum bolt cutting through, pointing onward. */}
      <g filter={glow ? "url(#sj-glow)" : undefined}>
        <polyline
          points="33,89 60,62 55,53 87,31"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon points="87,24 93,36 81,33" fill="#38bdf8" />
      </g>
    </svg>
  );
}
