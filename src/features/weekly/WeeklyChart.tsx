"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rpShort } from "@/lib/utils";

export interface ChartConfig {
  weeks: string[];
  areas: string[];
  values: Record<string, number[]>;
}

const COLORS: Record<string, [string, string]> = {
  SOLO: ["#6366f1", "#22d3ee"],
  DIY: ["#f97316", "#ec4899"],
  SEMARANG: ["#10b981", "#a3e635"],
  TAB: ["#eab308", "#fde047"],
};

function option(cfg: ChartConfig, isDark: boolean): EChartsOption {
  const txt = isDark ? "#94a3b8" : "#475569";
  const txt2 = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  const series = cfg.areas.map((a) => {
    const [c1, c2] = COLORS[a] ?? ["#94a3b8", "#e2e8f0"];
    return {
      name: a, type: "bar" as const, data: cfg.values[a] ?? [], barMaxWidth: 26,
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: c2 }, { offset: 1, color: c1 }]),
      },
      emphasis: { itemStyle: { shadowBlur: 16, shadowColor: c2 + "88" } },
    };
  });
  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => rpShort(Number(v)),
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: isDark ? "#e2e8f0" : "#0f172a" },
    },
    legend: { textStyle: { color: txt }, top: 0 },
    grid: { left: 8, right: 8, bottom: 0, top: 34, containLabel: true },
    xAxis: {
      type: "category", data: cfg.weeks,
      axisLine: { lineStyle: { color: grid } },
      axisLabel: { color: txt, fontWeight: 600 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: grid } },
      axisLabel: { color: txt2, formatter: (v: number) => rpShort(v).replace("Rp", "") },
    },
    series,
    animationDuration: 1200, animationDurationUpdate: 900, animationEasingUpdate: "elasticOut",
  };
}

export default function WeeklyChart({ config }: { config: ChartConfig }) {
  const { isDark } = useTheme();
  const ref = useECharts(option(config, isDark), [config, isDark]);
  return <div ref={ref} className="h-80 w-full" />;
}
