"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rpShort } from "@/lib/utils";

export const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

function option(values: number[], sel: number, isDark: boolean): EChartsOption {
  const txt = isDark ? "#94a3b8" : "#475569";
  const txt2 = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => rpShort(Number(v)),
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: isDark ? "#e2e8f0" : "#0f172a" },
    },
    grid: { left: 8, right: 8, bottom: 0, top: 24, containLabel: true },
    xAxis: {
      type: "category", data: MONTH_SHORT,
      axisLabel: { color: txt, fontWeight: 600 },
      axisLine: { lineStyle: { color: grid } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: grid } },
      axisLabel: { color: txt2, formatter: (v: number) => rpShort(v).replace("Rp", "") },
    },
    series: [{
      type: "bar", barMaxWidth: 28,
      data: values.map((v, i) => ({
        value: v,
        itemStyle: i === sel
          ? { borderRadius: [6, 6, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#fde047" }, { offset: 1, color: "#f59e0b" }]), shadowBlur: 14, shadowColor: "#f59e0b88" }
          : { borderRadius: [6, 6, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#22d3ee" }, { offset: 1, color: "#6366f1" }]) },
      })),
    }],
    animationDuration: 1000, animationDurationUpdate: 900, animationEasingUpdate: "elasticOut",
  };
}

export default function DapChart({ values, selectedMonth }: { values: number[]; selectedMonth: number }) {
  const { isDark } = useTheme();
  const ref = useECharts(option(values, selectedMonth, isDark), [values, selectedMonth, isDark]);
  return <div ref={ref} className="h-72 w-full" />;
}
