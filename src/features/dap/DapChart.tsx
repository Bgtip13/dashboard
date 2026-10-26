"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rpShort } from "@/lib/utils";

export const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

const gradient = (from: string, to: string) =>
  new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: from }, { offset: 1, color: to }]);

function option(values: number[], loss: number[], sel: number, isDark: boolean): EChartsOption {
  const txt = isDark ? "#94a3b8" : "#475569";
  const txt1 = isDark ? "#e2e8f0" : "#0f172a";
  const txt2 = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: txt1, fontSize: 13 },
      formatter: (params: unknown) => {
        const arr = (Array.isArray(params) ? params : []) as { axisValue?: string; seriesName?: string; value?: number }[];
        if (!arr.length) return "";
        const pick = (n: string) => Number(arr.find((p) => p.seriesName === n)?.value ?? 0);
        const a = pick("Aktual");
        const l = pick("Hilang");
        const lines = [`<b>${arr[0].axisValue ?? ""}</b>`, `Aktual: ${rpShort(a)}`];
        if (l > 0) {
          lines.push(`Hilang: <span style="color:#fb7185">${rpShort(l)}</span>`);
          lines.push(`Potensi: ${rpShort(a + l)}`);
        }
        return lines.join("<br/>");
      },
    },
    legend: {
      top: 0, right: 0, itemWidth: 10, itemHeight: 10, itemGap: 12,
      textStyle: { color: txt, fontSize: 13 },
      data: ["Aktual", "Hilang"],
    },
    grid: { left: 8, right: 8, bottom: 0, top: 32, containLabel: true },
    xAxis: {
      type: "category", data: MONTH_SHORT,
      axisLabel: { color: txt, fontWeight: 600, fontSize: 13 },
      axisLine: { lineStyle: { color: grid } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: grid } },
      axisLabel: { color: txt2, fontSize: 13, formatter: (v: number) => rpShort(v).replace("Rp", "") },
    },
    series: [
      {
        name: "Aktual", type: "bar", stack: "potensi", barMaxWidth: 28,
        // warna series dipakai legend; warna per-bar diatur di masing-masing data
        itemStyle: { color: "#6366f1" },
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            // sudut atas hanya dibulatkan kalau tidak ada blok hilang di atasnya
            borderRadius: loss[i] > 0 ? [0, 0, 0, 0] : [6, 6, 0, 0],
            color: i === sel
              ? gradient("#fde047", "#f59e0b")
              : gradient("#22d3ee", "#6366f1"),
            shadowBlur: i === sel ? 14 : 0,
            shadowColor: "#f59e0b88",
          },
        })),
      },
      {
        name: "Hilang", type: "bar", stack: "potensi", barMaxWidth: 28,
        itemStyle: { color: "#fb7185" },
        data: loss.map((v) => ({
          value: v,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: isDark ? "rgba(251,113,133,0.30)" : "rgba(244,63,94,0.18)",
            borderColor: "#fb7185",
            // bulan tanpa nilai tidak perlu digambar: border 1px tampak seperti bar tipis
            borderWidth: v > 0 ? 1 : 0,
          },
        })),
      },
    ],
    animationDuration: 1000, animationDurationUpdate: 900, animationEasingUpdate: "elasticOut",
  };
}

export default function DapChart({ values, loss, selectedMonth }: {
  values: number[]; loss: number[]; selectedMonth: number;
}) {
  const { isDark } = useTheme();
  const ref = useECharts(option(values, loss, selectedMonth, isDark), [values, loss, selectedMonth, isDark]);
  return <div ref={ref} className="h-80 w-full" />;
}
