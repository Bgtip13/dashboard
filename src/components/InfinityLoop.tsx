"use client";
import { useId } from "react";

export default function InfinityLoop({ className = "" }: { className?: string }) {
  const id = useId();
  const d = "M25,50 C25,28 46,28 50,50 C54,72 75,72 75,50 C75,28 54,28 50,50 C46,72 25,72 25,50 Z";
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {/* jalur redup */}
      <path d={d} stroke="rgba(148,163,184,0.2)" strokeWidth="7" strokeLinecap="round" />
      {/* energi yang mengalir keliling loop */}
      <path d={d} stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round"
        strokeDasharray="55 245" style={{ filter: "drop-shadow(0 0 6px #10b981)" }}>
        <animate attributeName="stroke-dashoffset" from="300" to="0" dur="2.4s" repeatCount="indefinite" />
      </path>
      {/* orb glowing yang mengejar keliling (nuansa ouroboros) */}
      <circle r="4.5" fill="#ffffff" style={{ filter: "drop-shadow(0 0 7px #a3e635)" }}>
        <animateMotion dur="2.4s" repeatCount="indefinite" path={d} />
      </circle>
    </svg>
  );
}
