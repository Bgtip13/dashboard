"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fetchWeekly, fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { rp } from "@/lib/utils";
import WeeklyChart, { type ChartConfig } from "@/features/weekly/WeeklyChart";
import WeeklyTable from "@/features/weekly/WeeklyTable";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";

const AREAS = ["GLOBAL", "SOLO", "DIY", "SEMARANG", "TAB"] as const;
const WEEKS = ["M1", "M2", "M3", "M4", "M5"] as const;
type Area = (typeof AREAS)[number];
type WeekSel = (typeof WEEKS)[number] | "ALL";

function Pills<T extends string>({ items, value, onChange, id }: {
  items: readonly T[]; value: T; onChange: (v: T) => void; id: string;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
      {items.map((it) => (
        <button key={it} onClick={() => onChange(it)} className="relative rounded-full px-4 py-1.5 text-sm">
          {value === it && (
            <motion.span layoutId={id} transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-0 rounded-full bg-indigo-500/30 ring-1 ring-indigo-400/50" />
          )}
          <span className={`relative ${value === it ? "text-indigo-200" : "text-slate-400"}`}>{it}</span>
        </button>
      ))}
    </div>
  );
}

export default function MingguanPage() {
  const { data, isLoading } = useQuery({ queryKey: ["weekly"], queryFn: fetchWeekly });
  const { data: monthly } = useQuery({ queryKey: ["monthly"], queryFn: fetchMonthly });
  const [area, setArea] = useState<Area>("GLOBAL");
  const [week, setWeek] = useState<WeekSel>("ALL");

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => (area === "GLOBAL" ? r.area !== "GLOBAL" : r.area === area)),
    [data, area]
  );
  const weekIdx = useMemo(
    () => (week === "ALL" ? [0, 1, 2, 3, 4] : [WEEKS.indexOf(week as (typeof WEEKS)[number])]),
    [week]
  );
  const areas = useMemo(() => {
    const all = data?.rows ?? [];
    return area === "GLOBAL"
      ? Array.from(new Set(all.filter((r) => r.area && r.area !== "GLOBAL").map((r) => r.area)))
      : [area];
  }, [data, area]);

  const config: ChartConfig = useMemo(() => {
    const values: Record<string, number[]> = {};
    for (const a of areas) {
      values[a] = weekIdx.map((w) =>
        rows.filter((r) => r.area === a).reduce((s, r) => s + (r.act[w] ?? 0), 0)
      );
    }
    return { weeks: weekIdx.map((w) => WEEKS[w]), areas, values };
  }, [rows, areas, weekIdx]);

  /** Target Periode:
   *  week = ALL   -> target bulanan (sama dengan halaman Bulanan utk area terpilih)
   *  week = M1-M5 -> gabungan target mingguan area terpilih (GLOBAL = SOLO+DIY+SEMARANG+TAB) */
  const tgt = useMemo(() => {
    if (week === "ALL") {
      const all = monthly?.rows ?? [];
      // ← FIX: saat GLOBAL, buang baris agregat GLOBAL biar nggak dobel hitung (5,8M jadi 11,6M)
      const m =
        area === "GLOBAL"
          ? all.filter((r) => r.area !== "GLOBAL")
          : all.filter((r) => r.area === area);
      return m.reduce((s, r) => s + r.target, 0);
    }
    return rows.reduce((s, r) => s + (r.targetPerMinggu ?? 0), 0) * weekIdx.length;
  }, [week, monthly, area, rows, weekIdx]);
  const act = rows.reduce((s, r) => s + weekIdx.reduce((t, w) => t + (r.act?.[w] ?? 0), 0), 0);
  const pcp = tgt ? (act / tgt) * 100 : 0;
  const badge = getBadge(pcp);

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Pencapaian Mingguan</h1>
        <p className="text-sm text-slate-400">
          {isLoading ? "Memuat…" : `Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Pills items={AREAS} value={area} onChange={setArea} id="w-area" />
        <Pills items={["ALL", ...WEEKS] as const} value={week} onChange={setWeek} id="w-week" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            {week === "ALL" ? "Target Bulanan" : "Target Mingguan"}
          </p>
          <CountUp value={tgt} format={rp} className="mt-1 block text-2xl font-bold" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Aktual</p>
          <CountUp value={act} format={rp} className="mt-1 block text-2xl font-bold text-emerald-300" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Pencapaian</p>
          <div className="mt-1 flex items-center gap-3">
            <CountUp value={pcp} format={(v) => `${v.toFixed(1)}%`} className="text-2xl font-bold" />
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ color: badge.color, background: badge.bg + "55" }}>
              <Icn e={badge.emoji} className="h-3.5 w-3.5" /> {badge.label}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pcp, 100)}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${badge.bg}, ${badge.color})` }} />
          </div>
        </motion.div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <WeeklyChart config={config} />
      </div>

      <WeeklyTable rows={rows} weekIdx={weekIdx} />
    </div>
  );
}
