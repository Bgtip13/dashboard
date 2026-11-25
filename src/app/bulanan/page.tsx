"use client";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { hariEfektif, rp } from "@/lib/utils";

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

  const areaRows = useMemo(() => {
    const source = (data?.rows ?? []).filter((r) => r.area !== "GLOBAL");
    return Array.from(new Set(source.map((r) => r.area))).map((areaName) => {
      const group = source.filter((r) => r.area === areaName);
      const first = group[0];
      return {
        ...first,
        target: group.reduce((sum, r) => sum + r.target, 0),
        aktual: group.reduce((sum, r) => sum + r.aktual, 0),
        trip: group.reduce((sum, r) => sum + r.trip, 0),
        tripKuota: group.reduce((sum, r) => sum + r.tripKuota, 0),
        potensi: group.reduce((sum, r) => sum + r.potensi, 0),
        taTotal: group.reduce((sum, r) => sum + r.taTotal, 0),
        noo: group.reduce((sum, r) => sum + r.noo, 0),
        reaktif: group.reduce((sum, r) => sum + r.reaktif, 0),
      };
    });
  }, [data]);
  const metrics = [
    { key: "Penjualan", value: pcp, display: `${pcp.toFixed(1)}%`, note: `${rp(act)} dari ${rp(tgt)}`, tone: "lime", detail: `Sisa ${rp(kejar)} untuk mencapai target`, actual: act, target: tgt },
    { key: "Trip", value: trip.total ? trip.jalan / trip.total * 100 : 0, display: isTab ? "∞" : `${trip.jalan}/${trip.total}`, note: isTab ? "Cabang & self-pickup" : `${Math.max(trip.total-trip.jalan,0)} trip tersisa`, tone: "blue", detail: `${trip.jalan} trip berjalan dari ${trip.total}`, actual: trip.jalan, target: trip.total },
    { key: "Kontribusi", value: kon.potensi ? kon.aktif / kon.potensi * 100 : 0, display: `${(kon.potensi ? kon.aktif / kon.potensi * 100 : 0).toFixed(1)}%`, note: `${kon.aktif} toko aktif dari ${kon.potensi}`, tone: "violet", detail: `${kon.noo} NOO · ${kon.reaktif} reaktif`, actual: kon.aktif, target: kon.potensi },
    { key: "Hari Efektif", value: he.total ? he.berjalan / he.total * 100 : 0, display: `${he.berjalan}/${he.total}`, note: `${Math.max(he.total-he.berjalan,0)} hari tersisa`, tone: "amber", detail: "Hari kerja efektif, tanpa Minggu", actual: he.berjalan, target: he.total },
  ];
  const areaStats = areaRows.map((r) => ({ area: r.area, actual: r.aktual, target: r.target, pct: r.target ? r.aktual / r.target * 100 : 0 }));
  return (
    <div className="page-redesign page-monthly space-y-7 py-5 sm:py-7">
      <PageHeader crumb="Laporan / Bulanan" title="Pencapaian Bulanan"
        sub={isLoading ? "Memuat data pencapaian…" : `Performa empat indikator utama · Diperbarui ${data?.updatedAt ? new Date(data.updatedAt).toLocaleString("id-ID") : "—"}`}>
        <div className="seg page-segmented">{AREAS.map((a) => <button key={a} onClick={() => setArea(a)} className={`relative rounded-full px-4 py-2.5 text-sm font-semibold ${area===a ? "is-active" : ""}`}>
          {area===a && <motion.span layoutId="area-pill" transition={{type:"spring",stiffness:400,damping:30}} className="absolute inset-0 rounded-full bg-indigo-500/30 ring-1 ring-indigo-400/50"/>}<span className="relative">{a}</span></button>)}</div>
      </PageHeader>

      <section className="monthly-overview">
        <div className="monthly-overview-copy">
          <div className="lbl">RINGKASAN KINERJA · {area === "GLOBAL" ? "SELURUH AREA" : area}</div>
          <div className="monthly-main-number"><CountUp value={pcp} format={(v)=>v.toFixed(1)} /> <span>%</span></div>
          <div className="monthly-status"><span className="chip-lime">{badge.emoji} {badge.label}</span><span>realisasi terhadap target penjualan</span></div>
          <div className="monthly-progress-track"><motion.div initial={{width:0}} animate={{width:`${Math.min(pcp,100)}%`}} transition={{duration:1,ease:"easeOut"}} /></div>
          <div className="monthly-total-row"><div><span>Aktual</span><b>{rp(act)}</b></div><div><span>Target</span><b>{rp(tgt)}</b></div><div><span>Kekurangan</span><b>{rp(kejar)}</b></div></div>
        </div>
        <div className="monthly-overview-side">
          <div className="lbl">ARAH PENCAPAIAN</div>
          <div className="monthly-callout"><span className="monthly-callout-icon">↗</span><div><b>{he.total-he.berjalan > 0 ? `${rp(kejar / Math.max(he.total-he.berjalan,1))} / hari` : "Periode selesai"}</b><p>Ritme penjualan harian yang dibutuhkan untuk mengejar target.</p></div></div>
          <div className="monthly-mini-grid"><div><span>Trip berjalan</span><b>{trip.jalan}<small> / {trip.total}</small></b></div><div><span>Toko aktif</span><b>{kon.aktif}<small> / {kon.potensi}</small></b></div></div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="section-heading"><div><div className="lbl">FOUR PERFORMANCE DRIVERS</div><h2>Empat indikator utama</h2><p>Ringkasan posisi setiap indikator dalam satu tampilan.</p></div><span className="section-index">01 / 03</span></div>
        <div className="metric-progress-grid">{metrics.map((m,i)=><motion.article key={m.key} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:i*.06}} className={`metric-progress-card metric-${m.tone}`}>
          <div className="metric-card-top"><span className="metric-number">0{i+1}</span><span className="metric-label">{m.key}</span><span className="metric-mark">↗</span></div>
          <div className="metric-value">{m.display}</div><p className="metric-note">{m.note}</p>
          <div className="metric-track"><motion.span initial={{width:0}} animate={{width:`${Math.min(m.value,100)}%`}} transition={{duration:1,delay:i*.08}} /></div>
          <div className="metric-foot"><span>{m.detail}</span><b>{m.value.toFixed(1)}%</b></div>
        </motion.article>)}</div>
      </section>

      <section className="space-y-4">
        <div className="section-heading"><div><div className="lbl">AREA PERFORMANCE</div><h2>Perbandingan antar area</h2><p>Kontribusi penjualan masing-masing area terhadap targetnya.</p></div><span className="section-index">02 / 03</span></div>
        <div className="area-performance-grid">{areaStats.map((a)=> <article className="area-performance-card" key={a.area}><div className="area-performance-head"><b>{a.area}</b><strong>{a.pct.toFixed(1)}%</strong></div><div className="area-performance-track"><span style={{width:`${Math.min(a.pct,100)}%`}} /></div><div className="area-performance-foot"><span>{rp(a.actual)}</span><span>Target {rp(a.target)}</span></div></article>)}</div>
        <div className="monthly-indicator-table-wrap"><table className="monthly-indicator-table"><thead><tr><th>Area</th><th>Penjualan</th><th>Trip</th><th>Kontribusi</th><th>Hari efektif</th></tr></thead><tbody>{areaRows.map((r)=>{const sales=r.target?r.aktual/r.target*100:0;const trips=r.tripKuota?r.trip/r.tripKuota*100:0;const contrib=r.potensi?r.taTotal/r.potensi*100:0;return <tr key={r.area}><td><b>{r.area}</b></td><td><strong>{sales.toFixed(1)}%</strong><small>{rp(r.aktual)} / {rp(r.target)}</small></td><td><strong>{area==="TAB"?"∞":`${r.trip}/${r.tripKuota}`}</strong><small>{area==="TAB"?"Cabang & self-pickup":`${trips.toFixed(1)}% kuota trip`}</small></td><td><strong>{contrib.toFixed(1)}%</strong><small>{r.taTotal} aktif / {r.potensi} potensi</small></td><td><strong>{he.berjalan}/{he.total}</strong><small>{r.noo} NOO · {r.reaktif} reaktif</small></td></tr>})}</tbody></table></div>
      </section>
      <section className="space-y-4"><div className="section-heading"><div><div className="lbl">DETAIL DATA</div><h2>Rincian pencapaian</h2><p>Data sumber per area untuk pemeriksaan dan pembahasan.</p></div><span className="section-index">03 / 03</span></div><MonthlyTable rows={rows} /></section>
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
