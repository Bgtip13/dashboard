"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { rp } from "@/lib/utils";
import { NAMA_BULAN, SEMUA_BULAN, fetchProdukSemuaBulan } from "@/lib/produk";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";
import BrandLogo from "@/components/BrandLogo";
import SearchSelect, { type SearchItem } from "@/components/SearchSelect";
import ProdukChart, { type ProdukChartConfig } from "@/components/ProdukChart";
import ProdukTrenChart, { type ProdukTrenConfig } from "@/components/ProdukTrenChart";

const PAGE_SIZE = 25;
const CHART_TOP = 10; // ← jumlah batang grafik

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

const selectCls =
  "h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-base text-slate-200 outline-none transition-colors hover:border-white/20 focus:border-indigo-400/60 [&>option]:bg-slate-900";

function StatCard({ label, icon, delay, children }: {
  label: string; icon: string; delay: number; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-500/10 blur-2xl transition-opacity group-hover:bg-cyan-400/15" />
      <div className="flex items-start justify-between">
        <p className="text-sm uppercase tracking-wider text-slate-400">{label}</p>
        <Icn e={icon} className="h-4 w-4 opacity-40" />
      </div>
      {children}
    </motion.div>
  );
}

type Delta = { dari: string; ke: string; persen: number | null } | null;

/** Persentase naik/turun berwarna; null = tidak bisa dihitung */
function Persen({ d }: { d: Delta }) {
  if (!d) return <span>–</span>;
  if (d.persen === null) return <span>tidak bisa dihitung (bulan sebelumnya 0)</span>;
  return (
    <span className={d.persen >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
      {d.persen >= 0 ? "▲" : "▼"} {Math.abs(d.persen).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
    </span>
  );
}

type Urut = "pj-desc" | "pj-asc" | "qty-desc" | "qty-asc";

function ProdukPageContent() {
  const sp = useSearchParams();
  const qc = useQueryClient();

  // Semua tab bulan (nama tab: Januari … Desember) diambil sekali, lalu dipilih di sisi klien
  const { data: semua, isLoading, error } = useQuery({
    queryKey: ["produk-semua"],
    queryFn: fetchProdukSemuaBulan,
    refetchInterval: 120_000,
  });
  const bulanList = useMemo(() => (semua?.bulan ?? []).map((b) => b.label), [semua]);
  const [bulanPilih, setBulanPilih] = useState(() => (sp.get("bulan") ?? "").trim());

  // Bulan efektif: pilihan user (jika valid) → kalau tidak, bulan terbaru yang ada datanya
  const bulanEff = useMemo(() => {
    if (bulanList.length === 0) return "";
    if (bulanPilih.toUpperCase() === SEMUA_BULAN) return SEMUA_BULAN;
    const hit = bulanList.find((l) => l.toLowerCase() === bulanPilih.toLowerCase() || l.split(" ")[0].toLowerCase() === bulanPilih.toLowerCase());
    return hit ?? bulanList[bulanList.length - 1];
  }, [bulanList, bulanPilih]);

  const data = useMemo(() => {
    if (!semua || !bulanEff) return undefined;
    const rows = bulanEff === SEMUA_BULAN
      ? semua.bulan.flatMap((b) => b.rows)
      : semua.bulan.find((b) => b.label === bulanEff)?.rows ?? [];
    return { updatedAt: semua.updatedAt, rows };
  }, [semua, bulanEff]);

  // Asisten AI membaca cache ["produk"] → isi dengan data bulan yang sedang tampil
  useEffect(() => {
    if (data) qc.setQueryData(["produk"], data);
  }, [data, qc]);

  // Filter awal bisa datang dari Asisten AI lewat query string (?area=&brand=&cari=…)
  const [area, setArea] = useState(() => (sp.get("area") ?? "").trim().toUpperCase() || "ALL");
  const [kategori, setKategori] = useState(() => (sp.get("kategori") ?? "").trim() || "ALL");
  const [brand, setBrand] = useState(() => (sp.get("brand") ?? "").trim() || "ALL");
  const [toko, setToko] = useState(() => (sp.get("toko") ?? "").trim() || "ALL");
  const [cari, setCari] = useState(() => sp.get("cari") ?? "");
  const [urut, setUrut] = useState<Urut>(() => {
    const raw = (sp.get("urut") ?? "").toLowerCase();
    return (["pj-desc", "pj-asc", "qty-desc", "qty-asc"] as const).includes(raw as Urut) ? (raw as Urut) : "pj-desc";
  });
  const [page, setPage] = useState(0);
  const [trenCari, setTrenCari] = useState(""); // nama barang / brand untuk grafik tren

  const rows = data?.rows ?? [];
  const areas = useMemo(() => uniqSorted(rows.map((r) => r.area)), [rows]);
  const kategoris = useMemo(() => uniqSorted(rows.map((r) => r.kategori)), [rows]);
  const brands = useMemo(() => uniqSorted(rows.map((r) => r.brand)), [rows]);

  // Filter yang tidak ada di data (mis. sisa perintah asisten) otomatis dianggap "ALL"
  const areaEff = area !== "ALL" && areas.length > 0 && !areas.includes(area) ? "ALL" : area;
  const kategoriEff = kategori !== "ALL" && kategoris.length > 0 && !kategoris.includes(kategori) ? "ALL" : kategori;
  const brandEff = brand !== "ALL" && brands.length > 0 && !brands.includes(brand) ? "ALL" : brand;

  // Daftar toko (kolom "Pelanggan") mengikuti area yang dipilih supaya daftarnya tidak terlalu panjang
  const tokos = useMemo(
    () => uniqSorted(rows.filter((r) => areaEff === "ALL" || r.area === areaEff).map((r) => r.pelanggan)),
    [rows, areaEff],
  );
  const tokoEff = toko !== "ALL" && tokos.length > 0 && !tokos.includes(toko) ? "ALL" : toko;

  const filtered = useMemo(() => {
    const terms = cari.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (areaEff !== "ALL" && r.area !== areaEff) return false;
      if (kategoriEff !== "ALL" && r.kategori !== kategoriEff) return false;
      if (brandEff !== "ALL" && r.brand !== brandEff) return false;
      if (tokoEff !== "ALL" && r.pelanggan !== tokoEff) return false;
      if (terms.length === 0) return true;
      const hay = `${r.barang} ${r.pelanggan} ${r.kecamatan} ${r.kabupaten} ${r.brand}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, areaEff, kategoriEff, brandEff, tokoEff, cari]);

  // Reset ke halaman pertama saat filter berubah (pola adjust-state-saat-render,
  // supaya tidak memicu render berantai lewat effect).
  const filterKey = `${bulanEff}|${areaEff}|${kategoriEff}|${brandEff}|${tokoEff}|${cari}|${urut}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setPage(0);
  }

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
    const m = new Map<string, { qty: number; penjualan: number; brand: string }>();
    for (const r of filtered) {
      const cur = m.get(r.barang);
      if (cur) { cur.qty += r.qty; cur.penjualan += r.penjualan; }
      else m.set(r.barang, { qty: r.qty, penjualan: r.penjualan, brand: r.brand });
    }
    // panjang batang mengikuti urutan (qty / penjualan); keduanya tetap ikut dibawa untuk label & tooltip
    const entries = [...m.entries()].map(([name, v]) => ({
      name, brand: v.brand, qty: v.qty, penjualan: v.penjualan,
      value: metric === "qty" ? v.qty : v.penjualan,
    }));
    entries.sort((a, b) => (urut.endsWith("desc") ? b.value - a.value : a.value - b.value));
    const top = entries.slice(0, CHART_TOP);
    // dibalik supaya peringkat 1 tampil paling atas (ECharts menggambar category dari bawah)
    return { items: [...top].reverse(), metric };
  }, [filtered, urut]);

  // Tren per bulan (Jan–Des): memakai SEMUA tab bulan, mengikuti filter area/kategori/brand
  // dan metric dari urutan (qty / penjualan). Pilihan bulan & kotak cari tabel tidak berpengaruh.
  const trenData = useMemo(() => {
    const metric: "penjualan" | "qty" = urut.startsWith("qty") ? "qty" : "penjualan";
    const terms = trenCari.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const values: (number | null)[] = Array(12).fill(null);
    const valuesRp: (number | null)[] = Array(12).fill(null);
    const valuesQty: (number | null)[] = Array(12).fill(null);
    const cocok = new Set<string>();
    const total = new Map<string, number>();
    for (const b of semua?.bulan ?? []) {
      const idx = NAMA_BULAN.findIndex((n) => b.label.startsWith(n));
      if (idx === -1) continue;
      let sumRp = 0, sumQty = 0;
      for (const r of b.rows) {
        if (areaEff !== "ALL" && r.area !== areaEff) continue;
        if (kategoriEff !== "ALL" && r.kategori !== kategoriEff) continue;
        if (brandEff !== "ALL" && r.brand !== brandEff) continue;
        if (tokoEff !== "ALL" && r.pelanggan !== tokoEff) continue;
        total.set(r.barang, (total.get(r.barang) ?? 0) + r.penjualan);
        if (terms.length > 0) {
          const hay = `${r.barang} ${r.brand}`.toLowerCase();
          if (!terms.every((t) => hay.includes(t))) continue;
        }
        cocok.add(r.barang);
        sumRp += r.penjualan;
        sumQty += r.qty;
      }
      valuesRp[idx] = sumRp;
      valuesQty[idx] = sumQty;
      values[idx] = metric === "qty" ? sumQty : sumRp;
    }
    // Setelah user memilih/mengetik produk (atau brand): tampilkan Penjualan DAN Qty bersamaan
    const dual = terms.length > 0;
    const config: ProdukTrenConfig = {
      labels: NAMA_BULAN.map((n) => n.slice(0, 3)), values, metric,
      ...(dual ? { dual: { penjualan: valuesRp, qty: valuesQty } } : {}),
    };
    const saran = [...total.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map(([n]) => n);
    // perubahan bulan terbaru vs bulan sebelumnya yang ada datanya
    const hitungDelta = (vals: (number | null)[]) => {
      const ada = vals.map((v, i) => (v == null ? -1 : i)).filter((i) => i !== -1);
      if (ada.length < 2) return null;
      const a = vals[ada[ada.length - 2]]!, b = vals[ada[ada.length - 1]]!;
      return { dari: NAMA_BULAN[ada[ada.length - 2]], ke: NAMA_BULAN[ada[ada.length - 1]], persen: a === 0 ? null : ((b - a) / Math.abs(a)) * 100 };
    };
    const delta = hitungDelta(values);
    const deltaDual = dual ? { penjualan: hitungDelta(valuesRp), qty: hitungDelta(valuesQty) } : null;
    return { config, saran, jumlahBarang: cocok.size, delta, deltaDual };
  }, [semua, areaEff, kategoriEff, brandEff, tokoEff, urut, trenCari]);

  // Item untuk filter ber-search bar
  const itemsBulan = useMemo<SearchItem[]>(() => [
    ...[...bulanList].reverse().map((l) => ({ value: l, label: l })),
    ...(bulanList.length > 1 ? [{ value: SEMUA_BULAN, label: "Semua Bulan" }] : []),
  ], [bulanList]);
  const itemsKategori = useMemo<SearchItem[]>(() => [{ value: "ALL", label: "Semua Kategori" }, ...kategoris.map((k) => ({ value: k, label: k }))], [kategoris]);
  const itemsBrand = useMemo<SearchItem[]>(() => [{ value: "ALL", label: "Semua Brand" }, ...brands.map((b) => ({ value: b, label: b }))], [brands]);
  const itemsToko = useMemo<SearchItem[]>(() => [{ value: "ALL", label: "Semua Toko" }, ...tokos.map((t) => ({ value: t, label: t }))], [tokos]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (error) {
    return (
      <div className="py-6">
        <h1 className="text-3xl font-bold">Penjualan Produk</h1>
        <p className="mt-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {(error as Error).message} — pastikan sheet sudah di-publish ke web.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 py-8">
      {/* Aksen cahaya latar */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-72 opacity-60"
        style={{ background: "radial-gradient(600px 200px at 30% 0%, rgba(99,102,241,0.18), transparent), radial-gradient(500px 200px at 75% 10%, rgba(34,211,238,0.10), transparent)" }} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            Penjualan Produk
            {bulanEff && <span className="ml-3 text-xl font-medium text-indigo-300">· {bulanEff === SEMUA_BULAN ? "Semua Bulan" : bulanEff}</span>}
          </h1>
          <p className="text-sm text-slate-400">
            {isLoading || !data ? "Memuat…" : `${rows.length.toLocaleString("id-ID")} baris · Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}
          </p>
        </div>
        {!isLoading && (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live · Google Sheets
          </span>
        )}
      </div>

      {semua && semua.catatan.length > 0 && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          Tab berikut tidak ikut tampil → {semua.catatan.join(" · ")}
        </p>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <SearchSelect value={bulanEff} onChange={setBulanPilih} items={itemsBulan} ariaLabel="Pilih bulan" placeholder="Cari bulan…" className="min-w-44" />
        <Pills items={["ALL", ...areas] as const} value={areaEff} onChange={setArea} id="p-area" />
        <SearchSelect value={kategoriEff} onChange={setKategori} items={itemsKategori} ariaLabel="Pilih kategori" placeholder="Cari kategori…" />
        <span className="flex items-center gap-2">
          <SearchSelect value={brandEff} onChange={setBrand} items={itemsBrand} ariaLabel="Pilih brand" placeholder="Cari brand…" />
          {brandEff !== "ALL" && <BrandLogo brand={brandEff} size={30} />}
        </span>
        <SearchSelect value={tokoEff} onChange={setToko} items={itemsToko} ariaLabel="Pilih toko" placeholder="Cari nama toko…" className="min-w-52" />
        <select value={urut} onChange={(e) => setUrut(e.target.value as Urut)} className={selectCls}>
          <option value="pj-desc">Penjualan tertinggi</option>
          <option value="pj-asc">Penjualan terendah</option>
          <option value="qty-desc">Qty terbanyak</option>
          <option value="qty-asc">Qty tersedikit</option>
        </select>
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang / pelanggan / kecamatan…"
          className="h-11 min-w-64 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-base text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60" />
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Transaksi" icon="🧾" delay={0}>
          <CountUp value={filtered.length} className="mt-1 block text-3xl font-bold tabular-nums" />
        </StatCard>
        <StatCard label="Total Qty" icon="📦" delay={0.05}>
          <CountUp value={totalQty} className="mt-1 block text-3xl font-bold tabular-nums" />
        </StatCard>
        <StatCard label="Total Penjualan" icon="💰" delay={0.1}>
          <CountUp value={totalRp} format={rp} className="mt-1 block text-3xl font-bold tabular-nums text-emerald-300" />
        </StatCard>
        <StatCard label="Barang Terjual" icon="🏷️" delay={0.15}>
          <CountUp value={barangUnik} className="mt-1 block text-3xl font-bold tabular-nums" />
        </StatCard>
      </div>

      {/* Grafik per barang (10, mengikuti filter & urutan, dengan logo brand) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="mb-2 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
          <Icn e="📊" className="h-4 w-4" />
          {chartCfg.metric === "qty" ? "Qty" : "Penjualan"} per barang —{" "}
          <span className="text-indigo-300">{urut.endsWith("desc") ? `${CHART_TOP} tertinggi` : `${CHART_TOP} terendah`}</span>
        </p>
        <ProdukChart config={chartCfg} />
      </div>

      {/* Tren per bulan */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
            <Icn e="📈" className="h-4 w-4" />
            Tren {trenData.config.dual ? "penjualan & qty" : trenData.config.metric === "qty" ? "qty" : "penjualan"} per bulan —{" "}
            <span className="text-indigo-300">{trenCari.trim() ? `${trenData.jumlahBarang} barang cocok` : "total sesuai filter"}</span>
          </p>
          <>
            <input list="tren-saran" value={trenCari} onChange={(e) => setTrenCari(e.target.value)}
              placeholder="Ketik nama barang / brand, kosongkan untuk total…"
              className="h-11 min-w-72 rounded-xl border border-white/10 bg-white/5 px-4 text-base text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60" />
            <datalist id="tren-saran">
              {trenData.saran.map((n) => <option key={n} value={n} />)}
            </datalist>
          </>
        </div>
        {trenData.deltaDual ? (
          trenData.deltaDual.penjualan && trenData.deltaDual.qty && (
            <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              <span>{trenData.deltaDual.penjualan.ke} vs {trenData.deltaDual.penjualan.dari}:</span>
              <span>Penjualan <Persen d={trenData.deltaDual.penjualan} /></span>
              <span>Qty <Persen d={trenData.deltaDual.qty} /></span>
            </p>
          )
        ) : trenData.delta && (
          <p className="mb-2 text-sm text-slate-400">
            {trenData.delta.ke} vs {trenData.delta.dari}: <Persen d={trenData.delta} />
          </p>
        )}
        {trenCari.trim() && trenData.jumlahBarang === 0 ? (
          <p className="py-16 text-center text-slate-500">🔍 Tidak ada barang/brand yang cocok.</p>
        ) : (
          <ProdukTrenChart config={trenData.config} />
        )}
        <p className="mt-2 text-xs text-slate-500">
          Ikut filter Area / Kategori / Brand / Toko. Tanpa produk dipilih: mengikuti urutan (qty atau penjualan); setelah produk dipilih: Penjualan dan Qty tampil bersamaan. Bulan tanpa tab ditampilkan putus.
        </p>
      </div>

      {/* Tabel */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-sm uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5 font-semibold">Area</th>
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
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-sm font-medium ${areaStyle(r.area)}`}>{r.area}</span></td>
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
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${r.penjualan < 0 ? "text-rose-300" : ""}`}>{rp(r.penjualan)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
          <span className="text-slate-400 tabular-nums">{filtered.length.toLocaleString("id-ID")} baris</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
              className="rounded-full border border-white/10 px-4 py-2 transition-colors hover:bg-white/10 disabled:opacity-40">◀ Prev</button>
            <span className="px-2 text-slate-400 tabular-nums">Hal {page + 1} / {pageCount}</span>
            <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-white/10 px-4 py-2 transition-colors hover:bg-white/10 disabled:opacity-40">Next ▶</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** key = query string, supaya perintah asisten berikutnya langsung menerapkan filter baru */
function ProdukPageWithParams() {
  const sp = useSearchParams();
  return <ProdukPageContent key={sp.toString()} />;
}

export default function ProdukPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Memuat…</div>}>
      <ProdukPageWithParams />
    </Suspense>
  );
}
