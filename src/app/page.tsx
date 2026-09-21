"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { hariEfektif, rp } from "@/lib/utils";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";

const NAMA = "Bagus Triawan";

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
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => r.area !== "GLOBAL"), [data]);
  const tgt = rows.reduce((s, r) => s + r.target, 0);
  const act = rows.reduce((s, r) => s + r.aktual, 0);
  const pcp = tgt ? (act / tgt) * 100 : 0;
  const badge = getBadge(pcp);
  const trip = { jalan: rows.reduce((s, r) => s + r.trip, 0), total: rows.reduce((s, r) => s + r.tripKuota, 0) };
  const kon = { potensi: rows.reduce((s, r) => s + r.potensi, 0), aktif: rows.reduce((s, r) => s + r.taTotal, 0) };
  const he = hariEfektif();
  const kejar = Math.max(tgt - act, 0);
  const sisaHe = Math.max(he.total - he.berjalan, 0);
  const ritme = sisaHe > 0 ? kejar / sisaHe : 0;

  const h = now?.getHours() ?? 0;
  const jam = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mnt = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  const dtk = now ? String(now.getSeconds()).padStart(2, "0") : "--";
  const tgl = now ? now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "…";

  return (
    <div className="space-y-6 py-6">
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
              className="text-sm uppercase tracking-[0.2em] text-slate-400">{tgl}</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="mt-2 text-3xl font-bold sm:text-4xl">
              {greeting(h)}, <span className="bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">{NAMA}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}
              className="mt-2 text-sm text-slate-400">Semangat mengejar target hari ini 🚀</motion.p>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="text-right">
            <p className="text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl">
              {jam}<span className="animate-pulse text-indigo-300">:</span>{mnt}
              <span className="text-2xl text-slate-400">:{dtk}</span>
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Waktu Indonesia Barat</p>
          </motion.div>
        </div>
      </div>

      {/* Ringkasan cepat */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "PCP Bulan Ini", node: (
            <div className="flex items-center gap-2">
              <CountUp value={pcp} format={(v) => `${v.toFixed(1)}%`} className="block text-2xl font-bold" />
              <Icn e={badge.emoji} className="h-4 w-4" />
            </div>) },
          { label: "Aktual vs Target", node: (
            <p className="text-sm font-bold">
              <span className="text-emerald-300"><CountUp value={act} format={rp} /></span>
              <span className="text-slate-500"> / <CountUp value={tgt} format={rp} /></span>
            </p>) },
          { label: "Trip", node: <p className="text-2xl font-bold">{trip.jalan}<span className="text-slate-500">/{trip.total}</span></p> },
          { label: "Hari Efektif", node: <p className="text-2xl font-bold">{he.berjalan}<span className="text-slate-500">/{he.total}</span></p> },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">{c.label}</p>
            <div className="mt-1">{c.node}</div>
          </motion.div>
        ))}
      </div>

      {/* Ritme harian */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs uppercase tracking-wider text-slate-400">Ritme yang dibutuhkan</p>
        <p className="mt-1 text-lg font-bold">
          {sisaHe > 0
            ? <>Kejar <span className="text-amber-300">{rp(kejar)}</span> dalam <span className="text-indigo-300">{sisaHe} hari efektif</span> → ± <span className="text-emerald-300">{rp(ritme)}</span>/hari</>
            : <>Bulan ini sudah selesai — siapkan target bulan depan! 🎯</>}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pcp, 100)}%` }} transition={{ duration: 1.4, ease: "easeOut" }}
            className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${badge.bg}, ${badge.color})` }} />
        </div>
      </motion.div>

      {/* Akses cepat */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {NAV.map((n, i) => (
          <motion.div key={n.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
            <Link href={n.href}
              className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]">
              <div className="flex items-center justify-between">
                <Icn e={n.icon} className="h-6 w-6 text-indigo-300" />
                <span className="text-slate-500 transition-transform group-hover:translate-x-1">→</span>
              </div>
              <p className="mt-3 font-bold">{n.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{n.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
