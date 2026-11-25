"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function MetricProgress({ title, eyebrow, pct, value, detail, footer, tone = "lime" }: {
  title: string; eyebrow: string; pct: number; value: string; detail: string; footer: ReactNode; tone?: "lime" | "slate" | "blue";
}) {
  const color = tone === "lime" ? "var(--lime-deep)" : tone === "blue" ? "#7ca7d8" : "#858b98";
  const safe = Math.max(0, Math.min(pct, 100));
  return <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="metric-progress panel-card">
    <div className="flex items-start justify-between gap-3"><div><p className="lbl">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2></div><span className="metric-mark" style={{ background: color }} /></div>
    <div className="mt-5 flex items-end justify-between gap-2"><div className="min-w-0"><p className="num-xl text-[2.5rem] sm:text-[2.8rem]">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><p className="mono text-sm" style={{ color }}>{Number.isFinite(pct) ? `${pct.toFixed(1)}%` : "—"}</p></div>
    <div className="metric-track mt-4"><motion.div initial={{ width: 0 }} animate={{ width: `${safe}%` }} transition={{ duration: 1, ease: "easeOut" }} style={{ background: color }} /></div>
    <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">{footer}</div>
  </motion.section>;
}
