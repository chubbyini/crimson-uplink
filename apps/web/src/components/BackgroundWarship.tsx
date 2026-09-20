"use client";

import React, { useEffect, useState } from "react";

export default function BackgroundWarship() {
  // Phase 0: Fully Solid Spacecraft
  // Phase 1: Disintegrating into Quantum Particle Cloud
  // Phase 2: Quantum Particles Converging & Re-integrating
  const [phase, setPhase] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 4800);

    return () => clearInterval(timer);
  }, []);

  // 72 quantum particles along the 3D isometric hull
  const particles = Array.from({ length: 72 }, (_, i) => {
    const angle = (i / 72) * Math.PI * 2;
    const distance = 90 + (i % 9) * 35;
    
    // Positioned along the ship's diagonal trajectory
    const baseX = 300 + (i % 18) * 36;
    const baseY = 90 + Math.floor(i / 18) * 40;

    return {
      id: i,
      x: baseX,
      y: baseY,
      dx: (Math.cos(angle) * distance + (i % 2 === 0 ? 60 : -60)).toFixed(1),
      dy: (Math.sin(angle) * distance - 25).toFixed(1),
      color: i % 4 === 0 ? "#38bdf8" : i % 4 === 1 ? "#ff2a55" : i % 4 === 2 ? "#ffffff" : "#ff758f",
      size: 2.5 + (i % 4) * 0.8,
    };
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-0 flex justify-center overflow-hidden opacity-55">
      <div className="relative w-[850px] lg:w-[1050px] h-[360px] lg:h-[450px]">
        {/* Realistic 3D Stylized Spacecraft Asset with Radial Fade Mask */}
        <div
          className="absolute inset-0 transition-all duration-1000 ease-in-out"
          style={{
            opacity: phase === 0 ? 0.95 : phase === 1 ? 0.08 : 0.55,
            transform:
              phase === 0
                ? "scale(1) translateY(0px)"
                : phase === 1
                ? "scale(0.94) translateY(6px)"
                : "scale(0.98) translateY(2px)",
            filter: phase === 1 ? "blur(4px) drop-shadow(0 0 20px #ff2a55)" : "drop-shadow(0 0 25px rgba(56,189,248,0.25))",
            maskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, black 40%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, black 40%, transparent 85%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/spacecraft.jpg"
            alt="Stylized Battlecruiser"
            className="w-full h-full object-cover object-center mix-blend-lighten"
          />
        </div>

        {/* SVG Quantum Disintegration Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1000 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="shipParticleGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Central Quantum Shockwave Ring on Disintegration */}
          <ellipse
            cx="500"
            cy="200"
            rx={phase === 1 ? "260" : "40"}
            ry={phase === 1 ? "110" : "15"}
            stroke="#ff2a55"
            strokeWidth={phase === 1 ? "1.5" : "0"}
            opacity={phase === 1 ? 0.7 : 0}
            strokeDasharray="6 6"
            className="transition-all duration-1000 ease-out"
          />

          {/* Floating Quantum Particle Cloud */}
          <g filter="url(#shipParticleGlow)">
            {particles.map((p) => {
              const currentTranslate =
                phase === 0
                  ? "translate(0px, 0px) scale(0)"
                  : phase === 1
                  ? `translate(${p.dx}px, ${p.dy}px) scale(1.8)`
                  : `translate(${parseFloat(p.dx) * 0.3}px, ${parseFloat(p.dy) * 0.3}px) scale(0.9)`;

              const currentOpacity = phase === 0 ? 0 : phase === 1 ? 0.95 : 0.4;

              return (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r={p.size}
                  fill={p.color}
                  className="transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1)"
                  style={{
                    transform: currentTranslate,
                    opacity: currentOpacity,
                    transformOrigin: `${p.x}px ${p.y}px`,
                  }}
                />
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
