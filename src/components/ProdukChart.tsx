"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rp, rpShort } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import BrandLogo from "@/components/BrandLogo";

/** value = panjang batang (qty atau penjualan, sesuai urutan); qty & penjualan selalu terisi untuk label/tooltip */
export interface ProdukChartItem { name: string; brand: string; value: number; qty: number; penjualan: number }
export interface ProdukChartConfig {
  items: ProdukChartItem[]; // urut dari batang paling BAWAH ke atas (hasil reverse di page)
  metric: "penjualan" | "qty";
}

// Geometri (px) — overlay HTML harus cocok persis dengan grid ECharts
const GRID = { left: 8, right: 8, top: 4, bottom: 0 };
const LOGO_COL = 36;  // kolom logo
const CHART_H = 540;  // tinggi chart (px), harus sama dengan style container

/** Ukuran adaptif: makin lebar halaman → kolom nama makin lebar & angka ditulis lengkap (tidak disingkat). */
interface Layout { nameCol: number; axisX: number; right: number; full: boolean }
function layoutDari(w: number): Layout {
  const full = w >= 900;                                    // cukup lebar → "Rp91.612.345", bukan "Rp91,6 jt"
  const right = full ? 340 : 230;                           // ruang label di ujung batang
  const nameCol = Math.round(Math.min(520, Math.max(200, w * 0.32)));
  return { nameCol, axisX: GRID.left + LOGO_COL + nameCol, right, full };
}

function option(cfg: ProdukChartConfig, isDark: boolean, L: Layout): EChartsOption {
  const uang = L.full ? rp : rpShort;
  const txt = isDark ? "#cbd5e1" : "#334155";
  const gridLine = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  const fmt = (v: number) => (cfg.metric === "penjualan" ? rpShort(v) : v.toLocaleString("id-ID"));
  const qtyTxt = (v: number) => `${v.toLocaleString("id-ID")} qty`;
  // Label di ujung batang: metrik utama dulu, lalu yang satunya
  const labelTxt = (it?: ProdukChartItem) =>
    !it ? "" : cfg.metric === "qty" ? `${qtyTxt(it.qty)} · ${uang(it.penjualan)}` : `${uang(it.penjualan)} · ${qtyTxt(it.qty)}`;
  const maxV = Math.max(...cfg.items.map((i) => i.value), 0);

  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params) => {
        const p = (Array.isArray(params) ? params[0] : params) as unknown as { dataIndex: number };
        const it = cfg.items[p.dataIndex];
        if (!it) return "";
        const esc = it.name.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        return `<b>${esc}</b><br/>Penjualan: <b>${rp(it.penjualan)}</b><br/>Qty: <b>${it.qty.toLocaleString("id-ID")}</b>`;
      },
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: isDark ? "#e2e8f0" : "#0f172a", fontSize: 17 },
    },
    grid: { left: L.axisX, right: L.right, top: GRID.top, bottom: GRID.bottom, containLabel: false },
    xAxis: {
      type: "value",
      max: maxV > 0 ? Math.ceil(maxV * 1.2) : undefined, // skala rapat
      splitLine: { lineStyle: { color: gridLine } },
      axisLabel: {
        color: txt,
        fontSize: 16,
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
      type: "bar", data: cfg.items.map((i) => i.value), barMaxWidth: 20,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: "#3b82f6" }, { offset: 1, color: "#22d3ee" },
        ]),
      },
      emphasis: { itemStyle: { shadowBlur: 12, shadowColor: "rgba(34,211,238,0.5)" } },
      label: {
        show: true, position: "right", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 18, fontWeight: 600,
        formatter: (p) => labelTxt(cfg.items[p.dataIndex]),
      },
    }],
    animationDuration: 900, animationDurationUpdate: 700, animationEasingUpdate: "cubicOut",
  };
}

export default function ProdukChart({ config }: { config: ProdukChartConfig }) {
  const { isDark } = useTheme();
  const wrap = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(1100);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(el.clientWidth || 1100);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // dibulatkan per 20px supaya chart tidak digambar ulang di setiap piksel saat jendela digeser
  const L = layoutDari(Math.round(w / 20) * 20);
  const ref = useECharts(option(config, isDark, L), [config, isDark, L.nameCol, L.right, L.full]);

  // Baris ke-i (0 = batang paling bawah) → posisi tengahnya dari atas:
  const n = Math.max(config.items.length, 1);
  const bandH = (CHART_H - GRID.top - GRID.bottom) / n;
  const nameColor = isDark ? "#e2e8f0" : "#1e293b";

  return (
    <div ref={wrap} className="relative w-full" style={{ height: CHART_H }}>
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
              <BrandLogo brand={it.brand} size={28} />
              <span className="truncate text-lg font-medium"
                style={{ color: nameColor, width: L.nameCol - 12 }} title={it.name}>
                {it.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
