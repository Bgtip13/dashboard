"use client";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rpShort } from "@/lib/utils";
import { KATEGORI, URUTAN_TANPA, isKerugian, type Ringkasan } from "@/lib/dapSegment";

function option(ringkas: Ringkasan, isDark: boolean): EChartsOption {
  const slices = [
    { name: KATEGORI.AKTIF.label, value: ringkas.perKategori.AKTIF.toko, color: KATEGORI.AKTIF.color },
    ...URUTAN_TANPA.map((k) => ({ name: KATEGORI[k].label, value: ringkas.perKategori[k].toko, color: KATEGORI[k].color })),
  ].filter((s) => s.value > 0);

  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "item",
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: isDark ? "#e2e8f0" : "#0f172a", fontSize: 12 },
      formatter: (p: unknown) => {
        const d = p as { name?: string; value?: number; percent?: number };
        return `${d.name ?? ""}: <b>${d.value ?? 0}</b> toko (${Number(d.percent ?? 0).toFixed(1)}%)`;
      },
    },
    series: [{
      type: "pie",
      radius: ["58%", "86%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: isDark ? "#0b1020" : "#eef2f8", borderWidth: 2 },
      emphasis: { scale: true, scaleSize: 5 },
      data: slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
      animationDuration: 900,
    }],
  };
}

export default function KomposisiToko({ ringkas }: { ringkas: Ringkasan }) {
  const { isDark } = useTheme();
  const ref = useECharts(option(ringkas, isDark), [ringkas, isDark]);
  const baris = [
    { key: "AKTIF" as const, label: KATEGORI.AKTIF.label, color: KATEGORI.AKTIF.color, toko: ringkas.perKategori.AKTIF.toko, target: ringkas.perKategori.AKTIF.target },
    ...URUTAN_TANPA.map((k) => ({ key: k, label: KATEGORI[k].label, color: KATEGORI[k].color, toko: ringkas.perKategori[k].toko, target: ringkas.perKategori[k].target })),
  ];

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-full shrink-0 sm:w-1/2">
        <div ref={ref} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-100">{ringkas.total.toLocaleString("id-ID")}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">toko</span>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2 text-xs">
        {baris.map((b) => {
          const pct = ringkas.total ? (b.toko / ringkas.total) * 100 : 0;
          return (
            <li key={b.key} className="flex items-start justify-between gap-2">
              <span className="flex min-w-0 items-start gap-1.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: b.color }} />
                <span className="min-w-0">
                  <span className="block truncate text-slate-300" title={KATEGORI[b.key].desc}>{b.label}</span>
                  <span className={`block text-[10px] ${isKerugian(b.key) ? "text-rose-300" : "text-slate-500"}`}>
                    {b.toko === 0 ? "—" : `${rpShort(b.target)}${isKerugian(b.key) ? " hilang" : " target"}`}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold text-slate-100">{b.toko}</span>
                <span className="block text-[10px] text-slate-500">{pct.toFixed(1)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
