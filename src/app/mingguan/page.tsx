"use client";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { fetchWeekly, fetchMonthly } from "@/lib/api";
import { badgeTone, getBadge } from "@/lib/badge";
import { useTheme } from "@/app/providers";
import { rp } from "@/lib/utils";
import WeeklyChart, { type ChartConfig } from "@/features/weekly/WeeklyChart";
import WeeklyTable from "@/features/weekly/WeeklyTable";
import PageHeader from "@/components/PageHeader";
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
    <div className="seg">
      {items.map((it) => (
        <button key={it} onClick={() => onChange(it)} className="relative rounded-full px-5 py-2 text-base">
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

function MingguanPageContent() {
  const sp = useSearchParams();
  const { isDark } = useTheme();
  const { data, isLoading } = useQuery({ queryKey: ["weekly"], queryFn: fetchWeekly });
  const { data: monthly } = useQuery({ queryKey: ["monthly"], queryFn: fetchMonthly });
  const [area, setArea] = useState<Area>(() => {
    const raw = (sp.get("area") ?? "").toUpperCase();
    return (AREAS as readonly string[]).includes(raw) ? (raw as Area) : "GLOBAL";
  });
  const [week, setWeek] = useState<WeekSel>(() => {
    const raw = (sp.get("minggu") ?? "").toUpperCase();
    return (["ALL", ...WEEKS] as readonly string[]).includes(raw) ? (raw as WeekSel) : "ALL";
  });

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
  const cumulativeConfig: ChartConfig = useMemo(() => {
    const values: Record<string, number[]> = {};
    for (const a of areas) {
      let total = 0;
      values[a] = weekIdx.map((w) => { total += rows.filter((r) => r.area === a).reduce((sum, r) => sum + (r.act[w] ?? 0), 0); return total; });
    }
    return { weeks: weekIdx.map((w) => WEEKS[w]), areas, values };
  }, [rows, areas, weekIdx]);
  const pcp = tgt ? (act / tgt) * 100 : 0;
  const badge = getBadge(pcp);

  return (
    <div className="page-redesign page-weekly module-workspace space-y-7 py-5 sm:py-7">
      <PageHeader crumb="Mingguan" title="Pencapaian Mingguan"
        sub={isLoading ? "Memuat…" : `Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}>
        <Pills items={AREAS} value={area} onChange={setArea} id="w-area" />
        <Pills items={["ALL", ...WEEKS] as const} value={week} onChange={setWeek} id="w-week" />
      </PageHeader>

      <div className="weekly-kpi-grid">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="weekly-kpi-card">
          <p className="lbl">
            {week === "ALL" ? "Target Bulanan" : "Target Mingguan"}
          </p>
          <CountUp value={tgt} format={rp} className="num-xl mt-2 block text-[2.2rem]" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="weekly-kpi-card">
          <p className="lbl">Aktual</p>
          <CountUp value={act} format={rp} className="num-xl mt-2 block text-[2.2rem] text-emerald-300" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="weekly-kpi-card">
          <p className="lbl">Pencapaian</p>
          <div className="mt-1 flex items-center gap-3">
            <CountUp value={pcp} format={(v) => `${v.toFixed(1)}%`} className="num-xl text-[2.2rem]" />
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold"
              style={badgeTone(badge, isDark)}>
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

      <section className="weekly-chart-grid">
        <article className="weekly-chart-panel weekly-chart-primary"><div className="chart-panel-heading"><div><span className="lbl">SALES VELOCITY</span><h2>Penjualan per minggu</h2><p>Kecepatan penjualan setiap area pada minggu terpilih.</p></div><span className="chart-panel-tag">AKTUAL</span></div><WeeklyChart config={config} /></article>
        <article className="weekly-chart-panel"><div className="chart-panel-heading"><div><span className="lbl">CUMULATIVE PERFORMANCE</span><h2>Akumulasi penjualan</h2><p>Perjalanan total penjualan dari awal periode.</p></div><span className="chart-panel-tag chart-panel-tag-lime">KUMULATIF</span></div><WeeklyChart config={cumulativeConfig} /></article>
      </section>
      <section className="weekly-table-section"><div className="section-heading"><div><div className="lbl">WEEKLY BREAKDOWN</div><h2>Rincian per area</h2><p>Perbandingan target dan aktual berdasarkan minggu.</p></div><span className="section-index">DATA DETAIL</span></div><WeeklyTable rows={rows} weekIdx={weekIdx} /></section>
    </div>
  );
}

/** key = query string, supaya perintah asisten berikutnya langsung menerapkan filter baru */
function MingguanPageWithParams() {
  const sp = useSearchParams();
  return <MingguanPageContent key={sp.toString()} />;
}

export default function MingguanPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Memuat…</div>}>
      <MingguanPageWithParams />
    </Suspense>
  );
}
