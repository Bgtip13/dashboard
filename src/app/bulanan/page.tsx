"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { hariEfektif, rp } from "@/lib/utils";
import PotionGauge from "@/features/monthly/PotionGauge";
import MonthlyTable from "@/features/monthly/MonthlyTable";
import CountUp from "@/components/CountUp";

const AREAS = ["GLOBAL", "SOLO", "DIY", "SEMARANG", "TAB"] as const;

export default function BulananPage() {
  const { data, isLoading } = useQuery({ queryKey: ["monthly"], queryFn: fetchMonthly });
  const [area, setArea] = useState<(typeof AREAS)[number]>("GLOBAL");

  // GLOBAL = jumlah 4 area (baris GLOBAL tidak ikut dihitung); filter lain = area tsb saja
  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => (area === "GLOBAL" ? r.area !== "GLOBAL" : r.area === area)),
    [data, area]
  );

  const trip = useMemo(() => ({
    jalan: rows.reduce((s, r) => s + r.trip, 0),
    total: rows.reduce((s, r) => s + r.tripKuota, 0),
  }), [rows]);
  const kon = useMemo(() => ({
    potensi: rows.reduce((s, r) => s + r.potensi, 0),
    aktif: rows.reduce((s, r) => s + r.taTotal, 0),
    noo: rows.reduce((s, r) => s + r.noo, 0),
    reaktif: rows.reduce((s, r) => s + r.reaktif, 0),
  }), [rows]);

  const { tgt, act } = useMemo(() => ({
    tgt: rows.reduce((s, r) => s + r.target, 0),
    act: rows.reduce((s, r) => s + r.aktual, 0),
  }), [rows]);

  const pcp = tgt ? (act / tgt) * 100 : 0;
  const kejar = Math.max(tgt - act, 0);
  const badge = getBadge(pcp);
  const he = hariEfektif();
  const isTab = area === "TAB";

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pencapaian Bulanan</h1>
          <p className="text-sm text-slate-400">
            {isLoading ? "Memuat…" : `Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {AREAS.map((a) => (
            <button key={a} onClick={() => setArea(a)} className="relative rounded-full px-4 py-1.5 text-sm">
              {area === a && (
                <motion.span layoutId="area-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-full bg-indigo-500/30 ring-1 ring-indigo-400/50" />
              )}
              <span className={`relative ${area === a ? "text-indigo-200" : "text-slate-400"}`}>{a}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PotionGauge title="Penjualan" pct={pcp} gradient={["#6366f1", "#22d3ee"]}
          formatter={(v) => `${v.toFixed(1)}%`} badge={badge}
          footer={
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Target</span><CountUp value={tgt} format={rp} className="font-medium text-slate-200" /></div>
              <div className="flex justify-between"><span className="text-slate-400">Aktual</span><CountUp value={act} format={rp} className="font-medium text-slate-200" /></div>
              <div className="flex justify-between"><span className="text-slate-400">Kejar 100%</span><CountUp value={kejar} format={rp} className="font-semibold text-amber-300" /></div>
            </div>
          } />

        <PotionGauge title="Trip" pct={trip.total ? (trip.jalan / trip.total) * 100 : 0}
          gradient={["#10b981", "#a3e635"]}
          infinite={isTab}
          formatter={() => (isTab ? "∞" : `${trip.jalan}/${trip.total}`)}
          footer={
            isTab ? (
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-emerald-300">Toko Cabang &amp; Pelanggan Self-pickup</span>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Trip sudah jalan</span><span className="font-semibold text-emerald-300">{trip.jalan}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Sisa trip</span><span className="font-semibold text-amber-300">{Math.max(trip.total - trip.jalan, 0)}</span></div>
              </div>
            )
          } />

        <PotionGauge title="Kontribusi" pct={kon.potensi ? (kon.aktif / kon.potensi) * 100 : 0}
          gradient={["#f97316", "#ec4899"]}
          formatter={(v) => `${v.toFixed(1)}%`}
          footer={
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="text-slate-400">Potensi Toko</span><CountUp value={kon.potensi} className="text-right font-medium text-slate-200" />
              <span className="text-slate-400">Toko Aktif</span><CountUp value={kon.aktif} className="text-right font-medium text-emerald-300" />
              <span className="text-slate-400">NOO</span><CountUp value={kon.noo} className="text-right font-medium text-slate-200" />
              <span className="text-slate-400">Reaktif</span><CountUp value={kon.reaktif} className="text-right font-medium text-sky-300" />
            </div>
          } />

        <PotionGauge title="Hari Efektif" pct={he.total ? (he.berjalan / he.total) * 100 : 0}
          gradient={["#0ea5e9", "#14b8a6"]}
          formatter={() => `${he.berjalan}/${he.total}`}
          footer={
            <div className="text-xs text-slate-400">
              Hari efektif berjalan <span className="font-semibold text-slate-200">{he.berjalan}</span> dari {he.total} (auto, tanpa Minggu)
            </div>
          } />
      </div>

      <MonthlyTable rows={rows} />
    </div>
  );
}
