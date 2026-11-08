"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rpShort } from "@/lib/utils";

export interface ProdukTrenConfig {
  labels: string[];              // 12 nama bulan singkat (Jan … Des)
  values: (number | null)[];     // null = tab bulan itu belum ada → garis putus
  metric: "penjualan" | "qty";
  /** diisi saat user memilih produk: tampilkan Penjualan (garis) dan Qty (batang, sumbu kanan) bersamaan */
  dual?: { penjualan: (number | null)[]; qty: (number | null)[] };
}

function optionDual(cfg: ProdukTrenConfig & { dual: NonNullable<ProdukTrenConfig["dual"]> }, isDark: boolean): EChartsOption {
  const txt = isDark ? "#94a3b8" : "#475569";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  const strong = isDark ? "#e2e8f0" : "#0f172a";
  const num = (v: unknown) => (v == null || v === "-" ? "belum ada data" : Number(v).toLocaleString("id-ID"));
  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    legend: { top: 0, textStyle: { color: txt, fontSize: 13 }, data: ["Penjualan", "Qty"] },
    tooltip: {
      trigger: "axis",
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: strong, fontSize: 13 },
      valueFormatter: (v) => (v == null || v === "-" ? "belum ada data" : num(v)),
      formatter: (params) => {
        const arr = (Array.isArray(params) ? params : [params]) as unknown as { axisValueLabel: string; seriesName: string; value: unknown }[];
        const head = arr[0]?.axisValueLabel ?? "";
        const rows = arr.map((p) => `${p.seriesName}: <b>${p.value == null || p.value === "-" ? "belum ada data" : p.seriesName === "Penjualan" ? rpShort(Number(p.value)) : num(p.value)}</b>`);
        return [`<b>${head}</b>`, ...rows].join("<br/>");
      },
    },
    grid: { left: 8, right: 8, top: 56, bottom: 8, containLabel: true },
    xAxis: {
      type: "category", data: cfg.labels, boundaryGap: true,
      axisLine: { lineStyle: { color: grid } }, axisTick: { show: false },
      axisLabel: { color: txt, fontSize: 13 },
    },
    yAxis: [
      {
        type: "value", position: "left", splitLine: { lineStyle: { color: grid } },
        axisLabel: { color: txt, fontSize: 13, formatter: (v: number) => rpShort(v).replace("Rp", "") },
      },
      {
        type: "value", position: "right", splitLine: { show: false },
        axisLabel: { color: "#22d3ee", fontSize: 13, formatter: (v: number) => v.toLocaleString("id-ID") },
      },
    ],
    series: [
      {
        name: "Qty", type: "bar", yAxisIndex: 1, data: cfg.dual.qty, barMaxWidth: 38,
        itemStyle: { color: "rgba(34,211,238,0.38)", borderRadius: [6, 6, 0, 0] },
        label: {
          show: true, position: "insideBottom", color: strong, fontSize: 11,
          formatter: (p) => (p.value == null ? "" : Number(p.value).toLocaleString("id-ID")),
        },
      },
      {
        name: "Penjualan", type: "line", yAxisIndex: 0, data: cfg.dual.penjualan, connectNulls: false, symbol: "circle", symbolSize: 9,
        lineStyle: { width: 3, color: "#3b82f6" },
        itemStyle: { color: "#22d3ee", borderColor: "#3b82f6", borderWidth: 2 },
        label: { show: true, position: "top", color: txt, fontSize: 12, formatter: (p) => (p.value == null ? "" : rpShort(Number(p.value))) },
      },
    ],
    animationDuration: 800, animationDurationUpdate: 600, animationEasingUpdate: "cubicOut",
  };
}

function option(cfg: ProdukTrenConfig, isDark: boolean): EChartsOption {
  if (cfg.dual) return optionDual({ ...cfg, dual: cfg.dual }, isDark);
  const txt = isDark ? "#94a3b8" : "#475569";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  const fmt = (v: number) => (cfg.metric === "penjualan" ? rpShort(v) : v.toLocaleString("id-ID"));
  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => (v == null || v === "-" ? "belum ada data" : fmt(Number(v))),
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: isDark ? "#e2e8f0" : "#0f172a", fontSize: 13 },
    },
    grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: "category", data: cfg.labels, boundaryGap: false,
      axisLine: { lineStyle: { color: grid } }, axisTick: { show: false },
      axisLabel: { color: txt, fontSize: 13 },
    },
    yAxis: {
      type: "value", splitLine: { lineStyle: { color: grid } },
      axisLabel: { color: txt, fontSize: 13, formatter: (v: number) => (cfg.metric === "penjualan" ? rpShort(v).replace("Rp", "") : v.toLocaleString("id-ID")) },
    },
    series: [{
      type: "line", data: cfg.values, connectNulls: false, symbol: "circle", symbolSize: 9,
      lineStyle: { width: 3, color: "#3b82f6" },
      itemStyle: { color: "#22d3ee", borderColor: "#3b82f6", borderWidth: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(99,102,241,0.35)" }, { offset: 1, color: "rgba(34,211,238,0.02)" },
        ]),
      },
      label: { show: true, position: "top", color: txt, fontSize: 12, formatter: (p) => (p.value == null ? "" : fmt(Number(p.value))) },
    }],
    animationDuration: 800, animationDurationUpdate: 600, animationEasingUpdate: "cubicOut",
  };
}

export default function ProdukTrenChart({ config }: { config: ProdukTrenConfig }) {
  const { isDark } = useTheme();
  const ref = useECharts(option(config, isDark), [config, isDark]);
  return <div ref={ref} className="w-full" style={{ height: 320 }} />;
}
