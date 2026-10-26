"use client";
import { motion } from "framer-motion";
import { useId } from "react";

/**
 * Emblem F.R.I.D.A.Y — cincin HUD ala arc reactor Iron Man.
 * Dekoratif: semua informasi ada di label tombol/panel.
 */
export default function FridayLogo({
  size = 28,
  active = false,
  className = "",
}: {
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const rim = `rim-${uid}`;
  const core = `core-${uid}`;
  const glow = `glow-${uid}`;

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="55%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <radialGradient id={core} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f0fdff" />
          <stop offset="45%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0e7490" />
        </radialGradient>
        <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* cincin luar berputar */}
      <motion.g
        style={{ transformOrigin: "24px 24px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: active ? 6 : 18, repeat: Infinity, ease: "linear" }}
      >
        <circle
          cx="24" cy="24" r="21" fill="none"
          stroke={`url(#${rim})`} strokeWidth="1.8"
          strokeLinecap="round" strokeDasharray="9 5.5"
        />
      </motion.g>

      {/* cincin dalam berlawanan arah */}
      <motion.g
        style={{ transformOrigin: "24px 24px" }}
        animate={{ rotate: -360 }}
        transition={{ duration: active ? 9 : 26, repeat: Infinity, ease: "linear" }}
      >
        <circle
          cx="24" cy="24" r="16.2" fill="none"
          stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.55"
          strokeLinecap="round" strokeDasharray="2 6.2"
        />
      </motion.g>

      {/* inti arc reactor */}
      <g filter={`url(#${glow})`}>
        <circle cx="24" cy="24" r="12" fill="#082f49" fillOpacity="0.85" stroke="#a5f3fc" strokeWidth="0.9" />
        <path
          d="M24 14.2 31.9 28.6H16.1Z"
          fill={`url(#${core})`} fillOpacity="0.22"
          stroke="#e0f2fe" strokeWidth="1.3" strokeLinejoin="round"
        />
        <circle cx="24" cy="24" r="3.1" fill={`url(#${core})`} />
        <circle cx="24" cy="24" r="1.1" fill="#f8fafc" />
      </g>

      {/* titik HUD di sekeliling inti */}
      {[0, 120, 240].map((deg) => (
        <circle
          key={deg}
          cx={24 + 14.2 * Math.cos(((deg - 90) * Math.PI) / 180)}
          cy={24 + 14.2 * Math.sin(((deg - 90) * Math.PI) / 180)}
          r="0.9" fill="#67e8f9" fillOpacity="0.9"
        />
      ))}
    </svg>
  );
}
