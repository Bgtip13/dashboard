"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { fetchDap, fetchMonthly } from "@/lib/api";
import { fetchMe } from "@/lib/me";
import { getBadge } from "@/lib/badge";
import { hariEfektif, rp, rpShort } from "@/lib/utils";
import {
  ambangTargetBesar, ringkasTren, teratasBawahTarget, teratasKurangTransaksi,
  type SorotanToko,
} from "@/lib/dapSegment";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";
import SorotanTokoList from "@/features/beranda/SorotanToko";
import { FilterSelect } from "@/components/FilterBar";
import MatrixChart from "@/components/MatrixChart";
import PageHeader from "@/components/PageHeader";
import { MONTH_SHORT } from "@/features/dap/DapChart";

const NAMA = "Bos";

const QUOTES = [
  "Konsistensi kecil setiap hari membangun hasil besar di akhir bulan.",
  "Jangan hanya melihat jarak ke target. Lihat juga ritme yang bisa dikendalikan hari ini.",
  "Performa terbaik lahir dari eksekusi yang terukur, bukan sekadar target yang tinggi.",
  "Satu kunjungan produktif hari ini bisa mengubah hasil satu minggu.",
];

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
  // cache ["me"] diisi Navbar; kartu akses cepat hanya untuk tab yang boleh dibuka akun ini
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false });
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
  const bulanIni = now ? now.getMonth() : new Date().getMonth();
  // Sorotan DAP bisa dilihat per bulan pilihan sendiri (null = ikut bulan berjalan)
  const [bulanPilih, setBulanPilih] = useState<number | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setQuoteIndex((v) => (v + 1) % QUOTES.length), 12000); return () => window.clearInterval(t); }, []);
  const bulan = bulanPilih ?? bulanIni;
  const dapTren = useMemo(() => ringkasTren(dapRows, bulanIni), [dapRows, bulanIni]);
  const sorotan = useMemo<{ bawah: SorotanToko[]; kurang: SorotanToko[]; ambang: number }>(() => {
    const ambang = ambangTargetBesar(dapRows);
    return {
      bawah: teratasBawahTarget(dapRows, bulan, 10),
      kurang: teratasKurangTransaksi(dapRows, bulan, 10, ambang),
      ambang,
    };
  }, [dapRows, bulan]);
  const dapMonthly = useMemo(
    () => Array.from({ length: 12 }, (_, m) => dapRows.reduce((sum, r) => sum + (r.bulanan[m] ?? 0), 0)),
    [dapRows]
  );
  const totalKurang = sorotan.bawah.reduce((s, t) => s + t.gap, 0);

  const h = now?.getHours() ?? 0;
  const jam = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mnt = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  const dtk = now ? String(now.getSeconds()).padStart(2, "0") : "--";
  const tgl = now ? now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "…";

  return (
    <div className="page-redesign page-dashboard space-y-7 py-5 sm:py-7">
      <PageHeader crumb="Beranda" title={<>{greeting(h)}, {NAMA}</>}
        sub={<>{tgl}{dapRows.length > 0 && <> · <b className="font-medium text-slate-200">{dapRows.length}</b> toko DAP · <span className="text-rose-300">{dapTren.turun} turun</span> · <span className="text-emerald-300">{dapTren.naik} naik</span> vs {MONTHS[bulan > 0 ? bulan - 1 : 11]}</>}</>}>
        <span className="chip-soft mono tabular-nums">{jam}:{mnt}<span className="opacity-50">:{dtk}</span> WIB</span>
        {me?.user.tabs.includes("dap") && <Link href="/dap" className="btn-ink">Buka DAP <span aria-hidden>→</span></Link>}
      </PageHeader>

      {/* Kartu utama: angka besar + grafik titik */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="text-[1.05rem] font-medium">PCP bulan ini</h2>
          <span className="lbl flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[var(--ink)]" />Aktual</span>
          <span className="lbl flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />Hilang</span>
          <span className="lbl flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ background: "color-mix(in srgb, var(--muted) 45%, transparent)" }} />Belum berjalan</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(15rem,20rem)_1fr]">
          <div>
            <div className="flex items-start gap-1">
              <CountUp value={pcp} format={(v) => v.toFixed(1)} className="num-xl block text-[4.6rem] sm:text-[6.2rem]" />
              <span className="mt-3 text-2xl font-light text-slate-400">%</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="chip-lime"><Icn e={badge.emoji} className="h-3 w-3" />{badge.label}</span>
              <span className="text-[0.78rem] text-slate-400">dari target <span className="text-slate-200">{rpShort(tgt)}</span></span>
            </div>
            <dl className="mt-6 divide-y divide-white/10 text-[0.85rem]">
              {[
                ["Aktual", rp(act)],
                ["Kejar 100%", rp(kejar)],
                ["Trip", `${trip.jalan}/${trip.total}`],
                ["Hari efektif", `${he.berjalan}/${he.total}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2">
                  <dt className="lbl">{k}</dt>
                  <dd className="mono tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <MatrixChart categories={MONTH_SHORT} series={[{ name: "Omset DAP", values: dapMonthly }]}
            fmt={(v) => rpShort(v)} nowIndex={bulanIni} nowLabel="BULAN INI" height={290} />
        </div>

        {/* Baris wawasan */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--card-inner)] px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#15161a] text-white dark:bg-[var(--lime)] dark:text-[#15161a]">
            <Icn e="🎯" className="h-4 w-4" />
          </span>
          <p className="min-w-0 flex-1 text-[0.88rem]">
            {sisaHe > 0
              ? <><b className="font-medium">Perlu ±{rp(ritme)}/hari</b> <span className="text-slate-400">selama {sisaHe} hari efektif untuk mengejar {rp(kejar)}.</span></>
              : <b className="font-medium">Bulan ini sudah selesai — siapkan target bulan depan!</b>}
          </p>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pcp, 100)}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full bg-[var(--lime-deep)]" />
          </div>
          {me?.user.tabs.includes("bulanan") && <Link href="/bulanan" className="btn-ghost">Detail <span aria-hidden>→</span></Link>}
        </div>
      </motion.section>

      <section className="dashboard-insight-grid">
        <article className="dashboard-insight-main">
          <div className="dashboard-insight-kicker"><span className="dashboard-pulse" /> PERFORMANCE INSIGHT</div>
          <h2>{pcp >= 100 ? "Target sudah terlampaui. Jaga konsistensi." : pcp >= 80 ? "Sudah mendekati target. Pertahankan ritme." : pcp >= 50 ? "Momentum sudah terbentuk. Tingkatkan intensitas." : "Saatnya membangun momentum penjualan."}</h2>
          <p>{pcp >= 100 ? `Realisasi saat ini ${pcp.toFixed(1)}%. Fokus menjaga kualitas transaksi dan membuka peluang tambahan.` : `Masih ada ${rp(kejar)} yang perlu dikejar. Dengan ${sisaHe} hari efektif tersisa, kebutuhan ritme saat ini sekitar ${rp(ritme)} per hari.`}</p>
          <div className="dashboard-insight-bottom"><span>PROGRES TARGET</span><b>{pcp.toFixed(1)}%</b><div><i style={{width:`${Math.min(pcp,100)}%`}} /></div></div>
        </article>
        <aside className="dashboard-quote-card"><span className="dashboard-quote-mark">“</span><div className="lbl">DAILY REMINDER</div><blockquote key={quoteIndex}>{QUOTES[quoteIndex]}</blockquote><div className="dashboard-quote-foot"><span>PCP FIELDNOTE</span><span>{String(quoteIndex+1).padStart(2,"0")} / 04</span></div></aside>
      </section>

      {/* Sorotan DAP: siapa yang perlu dikejar bulan ini */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[1.15rem] font-medium">Sorotan DAP</h2>
            <FilterSelect
              value={bulan}
              onChange={(v) => setBulanPilih(Number(v))}
              title="Pilih bulan sorotan"
            >
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </FilterSelect>
            {bulanPilih !== null && bulanPilih !== bulanIni && (
              <button
                type="button"
                onClick={() => setBulanPilih(null)}
                className="chip-soft"
              >
                Bulan ini
              </button>
            )}
          </div>
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
            href={`/dap?trx=BAWAH&urut=pcp&arah=asc&bulan=${bulan}`}
            empty={dapLoading ? "Memuat data DAP…" : `Belum ada toko yang di bawah target ${MONTHS[bulan]}.`}
          />
          <SorotanTokoList
            title="10 Toko Target Besar, Transaksi Kurang"
            hint={`Target besar tapi realisasi ${MONTHS[bulan]} belum separuh target — urut target terbesar`}
            items={sorotan.kurang}
            mode="kurang"
            href={`/dap?urut=targetToko&arah=desc&bulan=${bulan}`}
            empty={dapLoading ? "Memuat data DAP…" : `Tidak ada toko target besar yang tertinggal di ${MONTHS[bulan]}.`}
          />
        </div>
      </div>

      {/* Akses cepat */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {NAV.filter((n) => me?.user.tabs.includes(n.href.slice(1)) ?? false).map((n, i) => (
          <motion.div key={n.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
            <Link href={n.href}
              className="group block rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--raised)] shadow-[var(--raised-shadow)]"><Icn e={n.icon} className="h-5 w-5 text-indigo-300" /></span>
                <span className="text-slate-500 transition-transform group-hover:translate-x-1">→</span>
              </div>
              <p className="mt-4 text-[1.05rem] font-medium">{n.title}</p>
              <p className="mt-1 text-sm text-slate-400">{n.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
