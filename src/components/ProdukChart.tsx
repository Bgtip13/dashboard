"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rpShort } from "@/lib/utils";
import BrandLogo from "@/components/BrandLogo";

export interface ProdukChartItem { name: string; brand: string; value: number }
export interface ProdukChartConfig {
  items: ProdukChartItem[]; // urut dari batang paling BAWAH ke atas (hasil reverse di page)
  metric: "penjualan" | "qty";
}

// Geometri (px) — overlay HTML harus cocok persis dengan grid ECharts
const GRID = { left: 8, right: 8, top: 4, bottom: 0 };
const LOGO_COL = 26;  // kolom logo
const NAME_COL = 200; // kolom nama produk
const AXIS_X = GRID.left + LOGO_COL + NAME_COL; // posisi sumbu-Y (bars mulai di sini)
const CHART_H = 384;  // tinggi chart (px), harus sama dengan style container

function option(cfg: ProdukChartConfig, isDark: boolean): EChartsOption {
  const txt = isDark ? "#94a3b8" : "#475569";
  const gridLine = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  const fmt = (v: number) => (cfg.metric === "penjualan" ? rpShort(v) : v.toLocaleString("id-ID"));
  const maxV = Math.max(...cfg.items.map((i) => i.value), 0);

  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      valueFormatter: (v) => fmt(Number(v)),
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: isDark ? "#e2e8f0" : "#0f172a" },
    },
    grid: { left: AXIS_X, right: GRID.right, top: GRID.top, bottom: GRID.bottom, containLabel: false },
    xAxis: {
      type: "value",
      max: maxV > 0 ? Math.ceil(maxV * 1.2) : undefined, // skala rapat
      splitLine: { lineStyle: { color: gridLine } },
      axisLabel: {
        color: txt,
        formatter: (v: number) => (cfg.metric === "penjualan" ? rpShort(v).replace("Rp", "") : v.toLocaleString("id-ID")),
      },
    },
    yAxis: {
      type: "category",
      data: cfg.items.map((i) => i.name),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { show: false }, // logo & nama digambar oleh overlay HTML di bawah
    },
    series: [{
      type: "bar", data: cfg.items.map((i) => i.value), barMaxWidth: 16,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: "#6366f1" }, { offset: 1, color: "#22d3ee" },
        ]),
      },
      emphasis: { itemStyle: { shadowBlur: 12, shadowColor: "rgba(34,211,238,0.5)" } },
      label: { show: true, position: "right", color: txt, formatter: (p: { value: number }) => fmt(Number(p.value)) },
    }],
    animationDuration: 900, animationDurationUpdate: 700, animationEasingUpdate: "cubicOut",
  };
}

export default function ProdukChart({ config }: { config: ProdukChartConfig }) {
  const { isDark } = useTheme();
  const ref = useECharts(option(config, isDark), [config, isDark]);

  // Baris ke-i (0 = batang paling bawah) → posisi tengahnya dari atas:
  const n = Math.max(config.items.length, 1);
  const bandH = (CHART_H - GRID.top - GRID.bottom) / n;
  const nameColor = isDark ? "#cbd5e1" : "#334155";

  return (
    <div className="relative w-full" style={{ height: CHART_H }}>
      <div ref={ref} className="h-full w-full" />

      {/* Overlay: kolom logo + nama, rata kiri semua */}
      <div className="pointer-events-none absolute left-0 w-full"
        style={{ top: GRID.top, height: CHART_H - GRID.top - GRID.bottom }}>
        {config.items.map((it, i) => {
          const top = (n - 1 - i) * bandH + bandH / 2;
          return (
            <div key={`${it.name}-${i}`}
              className="absolute flex items-center gap-2"
              style={{ top, left: GRID.left, transform: "translateY(-50%)" }}>
              <BrandLogo brand={it.brand} size={20} />
              <span className="truncate text-xs font-medium"
                style={{ color: nameColor, width: NAME_COL - 12 }}>
                {it.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
