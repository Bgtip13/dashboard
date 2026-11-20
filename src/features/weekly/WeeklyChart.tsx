"use client";
import MatrixChart from "@/components/MatrixChart";
import { rpShort } from "@/lib/utils";

export interface ChartConfig {
  weeks: string[];
  areas: string[];
  values: Record<string, number[]>;
}

/** Warna seri: ink → abu bertingkat; "NOW" (minggu berjalan) ditandai lime oleh MatrixChart */
const TONE: Record<string, string> = {
  SOLO: "var(--ink)",
  DIY: "#6f727d",
  SEMARANG: "#a2a5af",
  TAB: "#c9ccd4",
};

export default function WeeklyChart({ config }: { config: ChartConfig }) {
  const label = `M${Math.floor((new Date().getDate() - 1) / 7) + 1}`;
  const idx = config.weeks.indexOf(label);
  return (
    <MatrixChart
      categories={config.weeks}
      series={config.areas.map((a) => ({ name: a, values: config.values[a] ?? [], color: TONE[a] }))}
      fmt={(v) => rpShort(v)}
      nowIndex={idx >= 0 ? idx : undefined}
      nowLabel="MINGGU INI"
      height={320}
    />
  );
}
