"use client";
import * as echarts from "echarts";
import "echarts-liquidfill";
import type { EChartsOption } from "echarts";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { showBadge, type BadgeInfo } from "@/lib/badge";
import FlagBadge from "@/components/FlagBadge";
import InfinityLoop from "@/components/InfinityLoop";
import Icn from "@/components/Icn";

const SHAPE = "circle";

function potionOption(
  pct: number, gradient: [string, string], fmt: (v: number) => string,
  labelColor: string, bgColor: string
) {
  const v = Math.min(Math.max(pct, 0), 100) / 100;
  const opt = {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    series: [
      {
        type: "liquidFill", shape: SHAPE, radius: "88%",
        data: [
          { value: v, direction: "left", itemStyle: { shadowBlur: 18, shadowColor: gradient[1] } },
          { value: Math.max(v - 0.035, 0) },
          { value: Math.max(v - 0.07, 0) },
        ],
        color: [gradient[1], gradient[0], gradient[0]],
        backgroundStyle: { color: bgColor },
        outline: {
          show: true, borderDistance: 6,
          itemStyle: { borderWidth: 2, borderColor: gradient[1] + "88", shadowBlur: 12, shadowColor: gradient[1] + "55" },
        },
        amplitude: 7, waveLength: "70%", period: 3200,
        label: { formatter: () => fmt(pct), fontSize: 26, fontWeight: 800, color: labelColor },
        silent: true,
      },
    ],
    animationDuration: 1600, animationDurationUpdate: 1000,
  };
  return opt as unknown as EChartsOption;
}

export default function PotionGauge({
  title, pct, gradient, formatter, badge, flag, footer, infinite = false,
}: {
  title: string; pct: number; gradient: [string, string];
  formatter: (v: number) => string; badge?: BadgeInfo; flag?: BadgeInfo; footer?: ReactNode;
  infinite?: boolean;
}) {
  const { isDark } = useTheme();
  const ref = useECharts(
    potionOption(pct, gradient, formatter,
      isDark ? "#f8fafc" : "#0f172a",
      isDark ? "rgba(148,163,184,0.06)" : "rgba(15,23,42,0.05)"),
    [pct, gradient, formatter, isDark]
  );
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition-shadow hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      {badge && showBadge() && (
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.6 }}
          className="absolute left-4 top-10 z-10 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: badge.color, background: badge.bg + "99", boxShadow: `0 0 18px ${badge.color}44` }}>
          <Icn e={badge.emoji} className="mr-1 h-3 w-3" /> {badge.label}
        </motion.span>
      )}
      {flag && showBadge() && <FlagBadge badge={flag} />}
      {infinite ? (
        <div className="flex h-44 w-full items-center justify-center"><InfinityLoop className="h-36" /></div>
      ) : (
        <div ref={ref} className="h-44 w-full" />
      )}
      {footer && <div className="border-t border-white/10 pt-3">{footer}</div>}
    </motion.div>
  );
}
