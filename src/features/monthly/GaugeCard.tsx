"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useECharts } from "@/hooks/useECharts";
import { showBadge, type BadgeInfo } from "@/lib/badge";

function gaugeOption(
  pct: number, arcMax: number, gradient: [string, string],
  formatter: (v: number) => string
): EChartsOption {
  return {
    series: [{
      type: "gauge",
      startAngle: 210, endAngle: -30,
      min: 0, max: arcMax, radius: "95%",
      progress: {
        show: true, width: 16, roundCap: true,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: gradient[0] }, { offset: 1, color: gradient[1] },
          ]),
          shadowBlur: 14, shadowColor: gradient[1],
        },
      },
      axisLine: { roundCap: true, lineStyle: { width: 16, color: [[1, "rgba(148,163,184,0.15)"]] } },
      axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
      detail: {
        valueAnimation: true, offsetCenter: [0, "8%"],
        fontSize: 30, fontWeight: 800, color: "#f8fafc", formatter,
      },
      title: { show: false },
      data: [{ value: Math.min(pct, arcMax) }],
    }],
    animationDuration: 1600,
    animationDurationUpdate: 1000,
    animationEasingUpdate: "cubicOut",
  };
}

export default function GaugeCard({
  title, pct, arcMax = 100, gradient, formatter, badge, footer,
}: {
  title: string; pct: number; arcMax?: number; gradient: [string, string];
  formatter: (v: number) => string; badge?: BadgeInfo; footer?: ReactNode;
}) {
  const ref = useECharts(gaugeOption(pct, arcMax, gradient, formatter), [pct, arcMax, formatter]);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition-shadow hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      {badge && showBadge() && (
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.6 }}
          className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: badge.color, background: badge.bg + "99", boxShadow: `0 0 18px ${badge.color}44` }}>
          {badge.emoji} {badge.label}
        </motion.span>
      )}
      <div ref={ref} className="h-44 w-full" />
      {footer && <div className="border-t border-white/10 pt-3">{footer}</div>}
    </motion.div>
  );
}
