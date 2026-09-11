"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rpShort } from "@/lib/utils";
import { MONTH_SHORT } from "./DapChart";

function option(values: number[], target: number, isDark: boolean): EChartsOption {
  const txt = isDark ? "#94a3b8" : "#475569";
  const txt2 = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "axis", valueFormatter: (v) => rpShort(Number(v)),
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: isDark ? "#e2e8f0" : "#0f172a" },
    },
    legend: { top: 0, textStyle: { color: txt, fontSize: 11 }, itemWidth: 14 },
    grid: { left: 8, right: 8, bottom: 0, top: 30, containLabel: true },
    xAxis: {
      type: "category", data: MONTH_SHORT,
      axisLabel: { color: txt },
      axisLine: { lineStyle: { color: grid } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: grid } },
      axisLabel: { color: txt2, formatter: (v: number) => rpShort(v).replace("Rp", "") },
    },
    series: [
      {
        name: "Aktual", type: "bar", data: values, barMaxWidth: 16,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#22d3ee" }, { offset: 1, color: "#6366f1" }]) },
        markPoint: {
          data: [{ type: "max", name: "Terbaik" }],
          symbolSize: 50, itemStyle: { color: "#f59e0b" },
          label: {
            color: "#78350f", fontWeight: 800, fontSize: 10,
            formatter: (p: { value: unknown }) => {
              const n = Number(p.value);
              return isFinite(n) ? rpShort(n) : "";
            },
          },
        },
      },
      {
        name: "Target/bulan", type: "line", data: values.map(() => target),
        symbol: "none",
        lineStyle: { width: 2, type: "dashed", color: "#f59e0b" },
      },
    ],
    animationDuration: 1100, animationDurationUpdate: 800, animationEasingUpdate: "cubicOut",
  };
}

export default function TokoSalesChart({ values, target }: { values: number[]; target: number }) {
  const { isDark } = useTheme();
  const ref = useECharts(option(values, target, isDark), [values, target, isDark]);
  return <div ref={ref} className="h-56 w-full" />;
}
