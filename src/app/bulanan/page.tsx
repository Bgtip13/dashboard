"use client";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { hariEfektif, rp } from "@/lib/utils";
import MetricProgress from "@/features/monthly/MetricProgress";
import MonthlyTable from "@/features/monthly/MonthlyTable";
import PageHeader from "@/components/PageHeader";
import CountUp from "@/components/CountUp";

const AREAS = ["GLOBAL", "SOLO", "DIY", "SEMARANG", "TAB"] as const;

function BulananPageContent() {
  const sp = useSearchParams();
  const { data, isLoading } = useQuery({ queryKey: ["monthly"], queryFn: fetchMonthly });
  const [area, setArea] = useState<(typeof AREAS)[number]>(() => {
    const raw = (sp.get("area") ?? "").toUpperCase();
    return (AREAS as readonly string[]).includes(raw) ? (raw as (typeof AREAS)[number]) : "GLOBAL";
  });

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
    <div className="space-y-8 py-8">
      <PageHeader crumb="Bulanan" title="Pencapaian Bulanan"
        sub={isLoading ? "Memuat…" : `Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}>
        <div className="seg">
          {AREAS.map((a) => (
            <button key={a} onClick={() => setArea(a)} className="relative rounded-full px-5 py-2 text-base">
              {area === a && (
                <motion.span layoutId="area-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-full bg-indigo-500/30 ring-1 ring-indigo-400/50" />
              )}
              <span className={`relative ${area === a ? "text-indigo-200" : "text-slate-400"}`}>{a}</span>
            </button>
          ))}
        </div>
      </PageHeader>

      <section className="monthly-overview panel-card">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="lbl">Ringkasan performa · {area}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Empat indikator utama</h2></div><span className="chip-lime">{badge.emoji} {badge.label}</span></div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricProgress title="Penjualan" eyebrow="01 / Revenue" pct={pcp} value={`${pcp.toFixed(1)}%`} detail={`${rp(act)} dari ${rp(tgt)}`} footer={<div className="space-y-1.5 text-sm"><div className="flex justify-between"><span className="text-slate-400">Target</span><CountUp value={tgt} format={rp} /></div><div className="flex justify-between"><span className="text-slate-400">Aktual</span><CountUp value={act} format={rp} /></div><div className="flex justify-between"><span className="text-slate-400">Kejar 100%</span><CountUp value={kejar} format={rp} className="font-semibold text-amber-300" /></div></div>} />
          <MetricProgress title="Trip" eyebrow="02 / Distribusi" pct={trip.total ? (trip.jalan / trip.total) * 100 : 100} value={isTab ? "∞" : `${trip.jalan}/${trip.total}`} detail={isTab ? "Cabang & self-pickup" : "Trip sudah berjalan"} tone="slate" footer={isTab ? <p className="text-sm text-slate-400">Toko Cabang &amp; Pelanggan Self-pickup</p> : <div className="space-y-1.5 text-sm"><div className="flex justify-between"><span className="text-slate-400">Trip sudah jalan</span><b>{trip.jalan}</b></div><div className="flex justify-between"><span className="text-slate-400">Sisa trip</span><b>{Math.max(trip.total - trip.jalan, 0)}</b></div></div>} />
          <MetricProgress title="Kontribusi" eyebrow="03 / Aktivasi" pct={kon.potensi ? (kon.aktif / kon.potensi) * 100 : 0} value={`${(kon.potensi ? (kon.aktif / kon.potensi) * 100 : 0).toFixed(1)}%`} detail={`${kon.aktif} toko aktif dari ${kon.potensi} potensi`} tone="blue" footer={<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm"><span className="text-slate-400">Potensi Toko</span><CountUp value={kon.potensi} className="text-right" /><span className="text-slate-400">Toko Aktif</span><CountUp value={kon.aktif} className="text-right text-emerald-300" /><span className="text-slate-400">NOO</span><CountUp value={kon.noo} className="text-right" /><span className="text-slate-400">Reaktif</span><CountUp value={kon.reaktif} className="text-right text-sky-300" /></div>} />
          <MetricProgress title="Hari Efektif" eyebrow="04 / Momentum" pct={he.total ? (he.berjalan / he.total) * 100 : 0} value={`${he.berjalan}/${he.total}`} detail="Hari efektif yang sudah berjalan" tone="slate" footer={<p className="text-sm text-slate-400">Hari efektif berjalan <b className="text-slate-200">{he.berjalan}</b> dari {he.total} (auto, tanpa Minggu)</p>} />
        </div>
      </section>

      <MonthlyTable rows={rows} />
    </div>
  );
}

/** key = query string, supaya perintah asisten berikutnya langsung menerapkan filter baru */
function BulananPageWithParams() {
  const sp = useSearchParams();
  return <BulananPageContent key={sp.toString()} />;
}

export default function BulananPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Memuat…</div>}>
      <BulananPageWithParams />
    </Suspense>
  );
}
