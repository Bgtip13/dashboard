"use client";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useECharts } from "@/hooks/useECharts";
import { useTheme } from "@/app/providers";
import { rpShort } from "@/lib/utils";
import type { HilangKab } from "@/lib/dapSegment";

function option(data: HilangKab[], isDark: boolean): EChartsOption {
  const txt = isDark ? "#94a3b8" : "#475569";
  const txt1 = isDark ? "#e2e8f0" : "#0f172a";
  const txt2 = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)";
  return {
    textStyle: { fontFamily: "SF Pro Display, Segoe UI, sans-serif" },
    tooltip: {
      trigger: "item",
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "#ffffff",
      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.15)",
      textStyle: { color: txt1, fontSize: 12 },
      formatter: (p: unknown) => {
        const d = p as { value?: number; dataIndex?: number };
        const row = data[d.dataIndex ?? 0];
        if (!row) return "";
        return `<b>${row.kabupaten}</b><br/>Hilang: <span style="color:#fb7185">${rpShort(row.nominal)}</span><br/>${row.toko} toko tanpa transaksi`;
      },
    },
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: grid } },
      axisLabel: { color: txt2, formatter: (v: number) => rpShort(v).replace("Rp", "") },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: data.map((d) => d.kabupaten),
      axisLabel: { color: txt, fontSize: 10, width: 110, overflow: "truncate" },
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
    },
    series: [{
      type: "bar",
      barMaxWidth: 16,
      data: data.map((d) => ({
        value: d.nominal,
        itemStyle: {
          borderRadius: [0, 5, 5, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "rgba(251,113,133,0.35)" },
            { offset: 1, color: "#fb7185" },
          ]),
        },
      })),
      label: {
        show: true, position: "right", color: txt, fontSize: 10,
        formatter: (p: unknown) => rpShort(Number((p as { value?: number }).value ?? 0)),
      },
    }],
    animationDuration: 900,
  };
}

export default function HilangPerKabupaten({ data }: { data: HilangKab[] }) {
  const { isDark } = useTheme();
  const ref = useECharts(option(data, isDark), [data, isDark]);
  return <div ref={ref} className="h-64 w-full" />;
}
