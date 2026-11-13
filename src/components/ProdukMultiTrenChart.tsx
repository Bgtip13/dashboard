"use client";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rp, rpShort } from "@/lib/utils";

export interface ProdukMultiSeries { name: string; values: number[] }
export interface ProdukMultiConfig {
  labels: string[];                 // satu label per hari
  series: ProdukMultiSeries[];      // satu garis per produk
  metric: "penjualan" | "qty";
}

export const WARNA_PRODUK = ["#3b82f6", "#22d3ee", "#a78bfa", "#f59e0b", "#34d399", "#f472b6", "#fb7185", "#94a3b8"];

const potong = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function option(cfg: ProdukMultiConfig, isDark: boolean): EChartsOption {
  const txt = isDark ? "#cbd5e1" : "#334155";
  const strong = isDark ? "#f1f5f9" : "#0f172a";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  const nilai = (v: number) => (cfg.metric === "penjualan" ? rp(v) : v.toLocaleString("id-ID"));
  const banyak = cfg.labels.length > 31;
  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    color: WARNA_PRODUK,
    legend: {
      type: "scroll", bottom: 0, itemGap: 18, itemWidth: 18, itemHeight: 10,
      textStyle: { color: txt, fontSize: 14 },
      formatter: (n: string) => potong(n, 34),
      pageTextStyle: { color: txt },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: strong, fontSize: 15 },
      formatter: (params) => {
        const arr = (Array.isArray(params) ? params : [params]) as unknown as
          { axisValueLabel: string; seriesName: string; value: number; marker: string }[];
        const urut = [...arr].sort((a, b) => Number(b.value) - Number(a.value));
        return [`<b>${arr[0]?.axisValueLabel ?? ""}</b>`,
          ...urut.map((p) => `${p.marker} ${esc(p.seriesName)}: <b>${nilai(Number(p.value))}</b>`)].join("<br/>");
      },
    },
    grid: { left: 8, right: 24, top: 24, bottom: 48, containLabel: true },
    xAxis: {
      type: "category", data: cfg.labels, boundaryGap: false,
      axisLine: { lineStyle: { color: grid } }, axisTick: { show: false },
      axisLabel: { color: txt, fontSize: 15 },
    },
    yAxis: {
      type: "value", splitLine: { lineStyle: { color: grid } },
      axisLabel: { color: txt, fontSize: 15, formatter: (v: number) => (cfg.metric === "penjualan" ? rpShort(v).replace("Rp", "") : v.toLocaleString("id-ID")) },
    },
    series: cfg.series.map((s) => ({
      name: s.name, type: "line" as const, data: s.values, smooth: false,
      symbol: "circle", symbolSize: banyak ? 5 : 9, showSymbol: !banyak,
      lineStyle: { width: 3 }, emphasis: { focus: "series" as const },
    })),
    animationDuration: 800, animationDurationUpdate: 600, animationEasingUpdate: "cubicOut",
  };
}

export default function ProdukMultiTrenChart({ config }: { config: ProdukMultiConfig }) {
  const { isDark } = useTheme();
  const ref = useECharts(option(config, isDark), [config, isDark]);
  return (
    <div className="w-full" style={{ height: "clamp(24rem, 46vh, 40rem)" }}>
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
