"use client";
import { motion } from "framer-motion";
import type { BadgeInfo } from "@/lib/badge";
import Icn from "./Icn";

export default function FlagBadge({ badge }: { badge: BadgeInfo }) {
  return (
    <div className="pointer-events-none absolute -right-1 top-3 z-10 flex items-start">
      <div className="h-24 w-1 rounded-full bg-gradient-to-b from-slate-200 via-slate-400 to-slate-700" />
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1, skewY: [0, 5, -4, 2, 0], scaleY: [1, 0.94, 1.03, 0.98, 1] }}
        transition={{
          skewY: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
          scaleY: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
          scaleX: { duration: 0.4 },
        }}
        className="origin-left rounded-r-xl border-r-4 px-3 py-2 text-xs font-bold leading-tight"
        style={{
          color: badge.color,
          background: `linear-gradient(100deg, ${badge.bg}f2, ${badge.bg}99)`,
          borderRightColor: badge.color,
          boxShadow: `0 0 18px ${badge.color}55`,
        }}
      >
        <Icn e={badge.emoji} className="mr-1 h-3 w-3" /> {badge.label}
      </motion.div>
    </div>
  );
}
