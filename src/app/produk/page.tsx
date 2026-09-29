"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { parseCsv } from "@/lib/csv";
import { rp } from "@/lib/utils";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";
import BrandLogo from "@/components/BrandLogo";
import ProdukChart, { type ProdukChartConfig } from "@/components/ProdukChart";

// Bisa dioverride lewat .env.local: NEXT_PUBLIC_SHEET_PRODUK=<url csv>
const PRODUK_URL =
  process.env.NEXT_PUBLIC_SHEET_PRODUK ??
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7sB47BzQsD42E5WB424nbKUjS2kldryPZqc0_S5JTjiT2vQyxa8cCxKP-LXJ1Q_gD3T2ZALg46lIB/pub?gid=1642504514&single=true&output=csv";

const PAGE_SIZE = 25;
const CHART_TOP = 10; // ← jumlah batang grafik

type ProdukRow = {
  area: string; kabupaten: string; kecamatan: string; kategori: string;
  brand: string; barang: string; pelanggan: string; qty: number; penjualan: number;
};
type ProdukPayload = { updatedAt: string; rows: ProdukRow[] };

const toNum = (s: unknown) => {
  const n = Number(String(s ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

async function fetchProduk(): Promise<ProdukPayload> {
  const sep = PRODUK_URL.includes("?") ? "&" : "?";
  const res = await fetch(`${PRODUK_URL}${sep}_=${Date.now()}`);
  if (!res.ok) throw new Error(`Gagal ambil data sheet (${res.status})`);
  const vals = await parseCsv(await res.text());
  const rows: ProdukRow[] = vals.slice(1)
    .filter((r) => r.join("").trim() !== "")
    .map((r) => ({
      area: String(r[0] ?? "").trim().toUpperCase(),
      kabupaten: String(r[1] ?? "").trim(),
      kecamatan: String(r[2] ?? "").trim(),
      kategori: String(r[3] ?? "").trim(),
      brand: String(r[4] ?? "").trim(),
      barang: String(r[5] ?? "").trim(),
      pelanggan: String(r[6] ?? "").trim(),
      qty: toNum(r[7]),
      penjualan: toNum(r[8]),
    }));
  return { updatedAt: new Date().toISOString(), rows };
}

const uniqSorted = (xs: string[]) => Array.from(new Set(xs.filter(Boolean))).sort();

// Warna pill area — senada dengan warna chart Mingguan
const AREA_STYLE: Record<string, string> = {
  SOLO: "bg-indigo-500/15 text-indigo-300",
  DIY: "bg-orange-500/15 text-orange-300",
  SEMARANG: "bg-emerald-500/15 text-emerald-300",
  TAB: "bg-yellow-500/15 text-yellow-300",
  CABANG: "bg-sky-500/15 text-sky-300",
};
const areaStyle = (a: string) => AREA_STYLE[a] ?? "bg-white/10 text-slate-300";

function Pills<T extends string>({ items, value, onChange, id }: {
  items: readonly T[]; value: T; onChange: (v: T) => void; id: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/5 p-1">
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

const selectCls =
  "h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-200 outline-none transition-colors hover:border-white/20 focus:border-indigo-400/60";

function StatCard({ label, icon, delay, children }: {
  label: string; icon: string; delay: number; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-500/10 blur-2xl transition-opacity group-hover:bg-cyan-400/15" />
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
        <Icn e={icon} className="h-4 w-4 opacity-40" />
      </div>
      {children}
    </motion.div>
  );
}

type Urut = "pj-desc" | "pj-asc" | "qty-desc" | "qty-asc";

export default function ProdukPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["produk"], queryFn: fetchProduk });
  const [area, setArea] = useState("ALL");
  const [kategori, setKategori] = useState("ALL");
  const [brand, setBrand] = useState("ALL");
  const [cari, setCari] = useState("");
  const [urut, setUrut] = useState<Urut>("pj-desc");
  const [page, setPage] = useState(0);

  const rows = data?.rows ?? [];
  const areas = useMemo(() => uniqSorted(rows.map((r) => r.area)), [rows]);
  const kategoris = useMemo(() => uniqSorted(rows.map((r) => r.kategori)), [rows]);
  const brands = useMemo(() => uniqSorted(rows.map((r) => r.brand)), [rows]);

  const filtered = useMemo(() => {
    const s = cari.trim().toLowerCase();
    return rows.filter((r) =>
      (area === "ALL" || r.area === area) &&
      (kategori === "ALL" || r.kategori === kategori) &&
      (brand === "ALL" || r.brand === brand) &&
      (!s || `${r.barang} ${r.pelanggan} ${r.kecamatan} ${r.kabupaten}`.toLowerCase().includes(s))
    );
  }, [rows, area, kategori, brand, cari]);

  useEffect(() => { setPage(0); }, [area, kategori, brand, cari, urut]);

  const sorted = useMemo(() => {
    const a = [...filtered];
    if (urut === "pj-desc") a.sort((x, y) => y.penjualan - x.penjualan);
    if (urut === "pj-asc") a.sort((x, y) => x.penjualan - y.penjualan);
    if (urut === "qty-desc") a.sort((x, y) => y.qty - x.qty);
    if (urut === "qty-asc") a.sort((x, y) => x.qty - y.qty);
    return a;
  }, [filtered, urut]);

  const totalQty = filtered.reduce((s, r) => s + r.qty, 0);
  const totalRp = filtered.reduce((s, r) => s + r.penjualan, 0);
  const barangUnik = useMemo(() => new Set(filtered.map((r) => r.barang)).size, [filtered]);

  // Data grafik: agregat per barang + brand-nya, ikut metric & arah urutan — tampilkan 10
  const chartCfg: ProdukChartConfig = useMemo(() => {
    const metric: "penjualan" | "qty" = urut.startsWith("qty") ? "qty" : "penjualan";
    const m = new Map<string, { val: number; brand: string }>();
    for (const r of filtered) {
      const add = metric === "qty" ? r.qty : r.penjualan;
      const cur = m.get(r.barang);
      if (cur) cur.val += add;
      else m.set(r.barang, { val: add, brand: r.brand });
    }
    const entries = [...m.entries()].map(([name, v]) => ({ name, brand: v.brand, value: v.val }));
    entries.sort((a, b) => (urut.endsWith("desc") ? b.value - a.value : a.value - b.value));
    const top = entries.slice(0, CHART_TOP);
    // dibalik supaya peringkat 1 tampil paling atas (ECharts menggambar category dari bawah)
    return { items: [...top].reverse(), metric };
  }, [filtered, urut]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (error) {
    return (
      <div className="py-6">
        <h1 className="text-2xl font-bold">Penjualan Produk</h1>
        <p className="mt-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {(error as Error).message} — pastikan sheet sudah di-publish ke web.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 py-6">
      {/* Aksen cahaya latar */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-72 opacity-60"
        style={{ background: "radial-gradient(600px 200px at 30% 0%, rgba(99,102,241,0.18), transparent), radial-gradient(500px 200px at 75% 10%, rgba(34,211,238,0.10), transparent)" }} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Penjualan Produk</h1>
          <p className="text-sm text-slate-400">
            {isLoading ? "Memuat…" : `${rows.length.toLocaleString("id-ID")} baris · Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}
          </p>
        </div>
        {!isLoading && (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live · Google Sheets
          </span>
        )}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <Pills items={["ALL", ...areas] as const} value={area} onChange={setArea} id="p-area" />
        <select value={kategori} onChange={(e) => setKategori(e.target.value)} className={selectCls}>
          <option className="bg-slate-900" value="ALL">Semua Kategori</option>
          {kategoris.map((k) => <option key={k} className="bg-slate-900" value={k}>{k}</option>)}
        </select>
        <span className="flex items-center gap-2">
          <select value={brand} onChange={(e) => setBrand(e.target.value)} className={selectCls}>
            <option className="bg-slate-900" value="ALL">Semua Brand</option>
            {brands.map((b) => <option key={b} className="bg-slate-900" value={b}>{b}</option>)}
          </select>
          {brand !== "ALL" && <BrandLogo brand={brand} size={30} />}
        </span>
        <select value={urut} onChange={(e) => setUrut(e.target.value as Urut)} className={selectCls}>
          <option className="bg-slate-900" value="pj-desc">Penjualan tertinggi</option>
          <option className="bg-slate-900" value="pj-asc">Penjualan terendah</option>
          <option className="bg-slate-900" value="qty-desc">Qty terbanyak</option>
          <option className="bg-slate-900" value="qty-asc">Qty tersedikit</option>
        </select>
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang / pelanggan / kecamatan…"
          className="h-10 min-w-56 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60" />
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Transaksi" icon="🧾" delay={0}>
          <CountUp value={filtered.length} className="mt-1 block text-2xl font-bold tabular-nums" />
        </StatCard>
        <StatCard label="Total Qty" icon="📦" delay={0.05}>
          <CountUp value={totalQty} className="mt-1 block text-2xl font-bold tabular-nums" />
        </StatCard>
        <StatCard label="Total Penjualan" icon="💰" delay={0.1}>
          <CountUp value={totalRp} format={rp} className="mt-1 block text-2xl font-bold tabular-nums text-emerald-300" />
        </StatCard>
        <StatCard label="Barang Terjual" icon="🏷️" delay={0.15}>
          <CountUp value={barangUnik} className="mt-1 block text-2xl font-bold tabular-nums" />
        </StatCard>
      </div>

      {/* Grafik per barang (10, mengikuti filter & urutan, dengan logo brand) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
          <Icn e="📊" className="h-4 w-4" />
          {chartCfg.metric === "qty" ? "Qty" : "Penjualan"} per barang —{" "}
          <span className="text-indigo-300">{urut.endsWith("desc") ? `${CHART_TOP} tertinggi` : `${CHART_TOP} terendah`}</span>
        </p>
        <ProdukChart config={chartCfg} />
      </div>

      {/* Tabel */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-semibold">Area</th>
                <th className="px-4 py-3 font-semibold">Kabupaten</th>
                <th className="px-4 py-3 font-semibold">Kecamatan</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Nama Barang</th>
                <th className="px-4 py-3 font-semibold">Pelanggan</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Penjualan</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">🔍 Tidak ada data yang cocok.</td></tr>
              )}
              {paged.map((r, i) => (
                <motion.tr key={`${r.area}-${r.pelanggan}-${r.barang}-${i}`}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/5 transition-colors hover:bg-white/[0.06]">
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${areaStyle(r.area)}`}>{r.area}</span></td>
                  <td className="px-4 py-3">{r.kabupaten}</td>
                  <td className="px-4 py-3">{r.kecamatan}</td>
                  <td className="px-4 py-3 text-slate-300">{r.kategori}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <BrandLogo brand={r.brand} size={24} />
                      <span className="whitespace-nowrap">{r.brand}</span>
                    </span>
                  </td>
                  <td className="max-w-72 truncate px-4 py-3 font-medium">{r.barang}</td>
                  <td className="px-4 py-3 text-slate-300">{r.pelanggan}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.qty.toLocaleString("id-ID")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums" style={{ color: r.penjualan < 0 ? "#f87171" : undefined }}>{rp(r.penjualan)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
          <span className="text-slate-400 tabular-nums">{filtered.length.toLocaleString("id-ID")} baris</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
              className="rounded-full border border-white/10 px-3.5 py-1.5 transition-colors hover:bg-white/10 disabled:opacity-40">◀ Prev</button>
            <span className="px-2 text-slate-400 tabular-nums">Hal {page + 1} / {pageCount}</span>
            <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-white/10 px-3.5 py-1.5 transition-colors hover:bg-white/10 disabled:opacity-40">Next ▶</button>
          </div>
        </div>
      </div>
    </div>
  );
}
