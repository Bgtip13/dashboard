"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { fetchDap, fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { hariEfektif, rp, rpShort } from "@/lib/utils";
import {
  ambangTargetBesar, ringkasTren, teratasBawahTarget, teratasKurangTransaksi,
  type SorotanToko,
} from "@/lib/dapSegment";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";
import SorotanTokoList from "@/features/beranda/SorotanToko";

const NAMA = "Bagus Triawan";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function greeting(h: number) {
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 19) return "Selamat sore";
  return "Selamat malam";
}

const NAV = [
  { href: "/bulanan", title: "Pencapaian Bulanan", desc: "4 gauge + badge PCP bulan berjalan", icon: "📊" },
  { href: "/mingguan", title: "Pencapaian Mingguan", desc: "Bar chart 3 area × 5 minggu", icon: "📈" },
  { href: "/dap", title: "DAP — Detail Toko", desc: "±790 toko, filter cascade + grafik", icon: "🏬" },
];

export default function BerandaPage() {
  const { data } = useQuery({ queryKey: ["monthly"], queryFn: fetchMonthly });
  const { data: dap, isLoading: dapLoading } = useQuery({ queryKey: ["dap"], queryFn: fetchDap });
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Jam baru diisi setelah mount (hindari hydration mismatch server/klien)
    const first = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => r.area !== "GLOBAL"), [data]);
  const tgt = rows.reduce((s, r) => s + r.target, 0);
  const act = rows.reduce((s, r) => s + r.aktual, 0);
  const pcp = tgt ? (act / tgt) * 100 : 0;
  const badge = getBadge(pcp);
  const trip = { jalan: rows.reduce((s, r) => s + r.trip, 0), total: rows.reduce((s, r) => s + r.tripKuota, 0) };
  const he = hariEfektif();
  const kejar = Math.max(tgt - act, 0);
  const sisaHe = Math.max(he.total - he.berjalan, 0);
  const ritme = sisaHe > 0 ? kejar / sisaHe : 0;

  // Sorotan DAP di beranda — memakai data toko yang sama dengan halaman DAP
  const dapRows = useMemo(() => dap?.rows ?? [], [dap]);
  const bulan = now ? now.getMonth() : new Date().getMonth();
  const dapTren = useMemo(() => ringkasTren(dapRows, bulan), [dapRows, bulan]);
  const sorotan = useMemo<{ bawah: SorotanToko[]; kurang: SorotanToko[]; ambang: number }>(() => {
    const ambang = ambangTargetBesar(dapRows);
    return {
      bawah: teratasBawahTarget(dapRows, bulan, 10),
      kurang: teratasKurangTransaksi(dapRows, bulan, 10, ambang),
      ambang,
    };
  }, [dapRows, bulan]);
  const totalKurang = sorotan.bawah.reduce((s, t) => s + t.gap, 0);

  const h = now?.getHours() ?? 0;
  const jam = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mnt = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  const dtk = now ? String(now.getSeconds()).padStart(2, "0") : "--";
  const tgl = now ? now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "…";

  return (
    <div className="space-y-8 py-8">
      {/* Sapaan + jam */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <motion.div aria-hidden
          animate={{ x: [0, 24, 0], y: [0, -18, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
        <motion.div aria-hidden
          animate={{ x: [0, -20, 0], y: [0, 14, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="text-base uppercase tracking-[0.2em] text-slate-400">{tgl}</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="mt-2 text-4xl font-bold sm:text-5xl">
              {greeting(h)}, <span className="bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">{NAMA}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}
              className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-slate-400">
              {dapRows.length > 0 ? (
                <>
                  <span><b className="text-slate-200">{dapRows.length}</b> toko DAP</span>
                  <span className="text-slate-600">·</span>
                  <span><b className="text-rose-300">{dapTren.turun}</b> turun</span>
                  <span className="text-slate-600">·</span>
                  <span><b className="text-emerald-300">{dapTren.naik}</b> naik</span>
                  <span className="text-slate-600">·</span>
                  <span>vs {MONTHS[bulan > 0 ? bulan - 1 : 11]}</span>
                </>
              ) : (
                "Semangat mengejar target hari ini 🚀"
              )}
            </motion.p>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="text-right">
            <p className="text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl">
              {jam}<span className="animate-pulse text-indigo-300">:</span>{mnt}
              <span className="text-3xl text-slate-400">:{dtk}</span>
            </p>
            <p className="mt-1 text-sm uppercase tracking-widest text-slate-500">Waktu Indonesia Barat</p>
          </motion.div>
        </div>
      </div>

      {/* Ringkasan cepat */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "PCP Bulan Ini", node: (
            <div className="flex items-center gap-2">
              <CountUp value={pcp} format={(v) => `${v.toFixed(1)}%`} className="block text-3xl font-bold" />
              <Icn e={badge.emoji} className="h-5 w-5" />
            </div>) },
          { label: "Aktual vs Target", node: (
            <p className="text-base font-bold">
              <span className="text-emerald-300"><CountUp value={act} format={rp} /></span>
              <span className="text-slate-500"> / <CountUp value={tgt} format={rp} /></span>
            </p>) },
          { label: "Trip", node: <p className="text-3xl font-bold">{trip.jalan}<span className="text-slate-500">/{trip.total}</span></p> },
          { label: "Hari Efektif", node: <p className="text-3xl font-bold">{he.berjalan}<span className="text-slate-500">/{he.total}</span></p> },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm uppercase tracking-wider text-slate-400">{c.label}</p>
            <div className="mt-1">{c.node}</div>
          </motion.div>
        ))}
      </div>

      {/* Ritme harian */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm uppercase tracking-wider text-slate-400">Ritme yang dibutuhkan</p>
        <p className="mt-1 text-xl font-bold">
          {sisaHe > 0
            ? <>Kejar <span className="text-amber-300">{rp(kejar)}</span> dalam <span className="text-indigo-300">{sisaHe} hari efektif</span> → ± <span className="text-emerald-300">{rp(ritme)}</span>/hari</>
            : <>Bulan ini sudah selesai — siapkan target bulan depan! 🎯</>}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pcp, 100)}%` }} transition={{ duration: 1.4, ease: "easeOut" }}
            className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${badge.bg}, ${badge.color})` }} />
        </div>
      </motion.div>

      {/* Sorotan DAP: siapa yang perlu dikejar bulan ini */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Sorotan DAP · {MONTHS[bulan]}</h2>
          <p className="text-sm text-slate-400">
            Top 10 di bawah target kurang <span className="font-semibold text-amber-300">{rpShort(totalKurang)}</span>
            {sorotan.ambang > 0 && <> · target besar ≥ {rpShort(sorotan.ambang)}</>}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SorotanTokoList
            title="10 Toko Penjualan di Bawah Target"
            hint={`Sudah transaksi ${MONTHS[bulan]} tapi belum mencapai target toko — urut kekurangan terbesar`}
            items={sorotan.bawah}
            mode="bawah"
            href="/dap?trx=BAWAH&urut=pcp&arah=asc"
            empty={dapLoading ? "Memuat data DAP…" : "Belum ada toko yang di bawah target bulan ini."}
          />
          <SorotanTokoList
            title="10 Toko Target Besar, Transaksi Kurang"
            hint={`Target besar tapi realisasi ${MONTHS[bulan]} belum separuh target — urut target terbesar`}
            items={sorotan.kurang}
            mode="kurang"
            href="/dap?urut=targetToko&arah=desc"
            empty={dapLoading ? "Memuat data DAP…" : "Tidak ada toko target besar yang tertinggal."}
          />
        </div>
      </div>

      {/* Akses cepat */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {NAV.map((n, i) => (
          <motion.div key={n.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
            <Link href={n.href}
              className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]">
              <div className="flex items-center justify-between">
                <Icn e={n.icon} className="h-7 w-7 text-indigo-300" />
                <span className="text-slate-500 transition-transform group-hover:translate-x-1">→</span>
              </div>
              <p className="mt-3 text-lg font-bold">{n.title}</p>
              <p className="mt-1 text-sm text-slate-400">{n.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
