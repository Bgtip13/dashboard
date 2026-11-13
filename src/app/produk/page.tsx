"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { rp } from "@/lib/utils";
import { NAMA_BULAN, SEMUA_BULAN, fetchProdukSemuaBulan, formatTanggal, rentangHari, tambahHari } from "@/lib/produk";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";
import BrandLogo from "@/components/BrandLogo";
import DateRangePicker from "@/components/DateRangePicker";
import SearchSelect, { type SearchItem } from "@/components/SearchSelect";
import ProdukChart, { type ProdukChartConfig } from "@/components/ProdukChart";
import ProdukMultiTrenChart, { WARNA_PRODUK, type ProdukMultiConfig } from "@/components/ProdukMultiTrenChart";
import ProdukTrenChart, { type ProdukTrenConfig } from "@/components/ProdukTrenChart";

const PAGE_SIZE = 25;
const CHART_TOP = 10; // ← jumlah batang grafik
const TREN_PRODUK_GARIS = 5;  // ← jumlah produk (garis) pada tren per produk
const TREN_PRODUK_TABEL = 10; // ← jumlah baris tabel ranking produk

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
  if (d.persen === null) return <span>tidak bisa dihitung (pembanding 0)</span>;
  return (
    <span className={d.persen >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
      {d.persen >= 0 ? "▲" : "▼"} {Math.abs(d.persen).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
    </span>
  );
}

/** Perubahan vs periode sebelumnya untuk satu produk (ringkas, cocok untuk sel tabel). */
function Perubahan({ now, prev, ada }: { now: number; prev: number; ada: boolean }) {
  if (!ada) return <span className="text-slate-500">–</span>;
  if (prev === 0) return now === 0 ? <span className="text-slate-500">–</span> : <span className="font-semibold text-indigo-300">baru</span>;
  const p = ((now - prev) / Math.abs(prev)) * 100;
  return (
    <span className={p >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
      {p >= 0 ? "▲" : "▼"} {Math.abs(p).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
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
  // Filter rentang tanggal (YYYY-MM-DD); kosong = tanpa batas. Bila aktif, data diambil dari SEMUA bulan
  // (rentang boleh melewati pergantian bulan) dan pilihan bulan diabaikan.
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const periodeAktif = Boolean(dari || sampai);
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
    const rows = bulanEff === SEMUA_BULAN || periodeAktif
      ? semua.bulan.flatMap((b) => b.rows)
      : semua.bulan.find((b) => b.label === bulanEff)?.rows ?? [];
    return { updatedAt: semua.updatedAt, rows };
  }, [semua, bulanEff, periodeAktif]);

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

  // Tanggal paling awal / akhir di seluruh tab + daftar tanggal yang punya transaksi (untuk kalender & grafik harian)
  const [tglMin, tglMax, tanggalAda] = useMemo(() => {
    let lo = "", hi = "";
    const ada = new Set<string>();
    for (const b of semua?.bulan ?? []) for (const r of b.rows) {
      if (!r.tanggal) continue;
      ada.add(r.tanggal);
      if (!lo || r.tanggal < lo) lo = r.tanggal;
      if (!hi || r.tanggal > hi) hi = r.tanggal;
    }
    return [lo, hi, ada] as const;
  }, [semua]);

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

  const cariTunda = useDeferredValue(cari);
  const filtered = useMemo(() => {
    const terms = cariTunda.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (areaEff !== "ALL" && r.area !== areaEff) return false;
      if (kategoriEff !== "ALL" && r.kategori !== kategoriEff) return false;
      if (brandEff !== "ALL" && r.brand !== brandEff) return false;
      if (tokoEff !== "ALL" && r.pelanggan !== tokoEff) return false;
      if (dari || sampai) {
        // baris tanpa tanggal tidak ikut saat filter tanggal aktif
        if (!r.tanggal) return false;
        if (dari && r.tanggal < dari) return false;
        if (sampai && r.tanggal > sampai) return false;
      }
      if (terms.length === 0) return true;
      const hay = `${r.barang} ${r.pelanggan} ${r.kecamatan} ${r.kabupaten} ${r.brand}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, areaEff, kategoriEff, brandEff, tokoEff, cariTunda, dari, sampai]);

  // Reset ke halaman pertama saat filter berubah (pola adjust-state-saat-render,
  // supaya tidak memicu render berantai lewat effect).
  const filterKey = `${bulanEff}|${areaEff}|${kategoriEff}|${brandEff}|${tokoEff}|${cari}|${urut}|${dari}|${sampai}`;
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

  // Tren PER HARI pada rentang tanggal terpilih (tambahan; tren bulanan di atas tidak berubah).
  // Memakai semua tab bulan, jadi rentang boleh melewati pergantian bulan. Ikut filter Area/Kategori/Brand/Toko
  // dan kotak produk/brand tren. Hari tanpa transaksi = 0. Dibandingkan dengan periode sebelumnya yang sama panjang.
  const trenHarian = useMemo(() => {
    if (!periodeAktif || !semua) return null;
    const awal = dari || tglMin, akhir = sampai || tglMax;
    if (!awal || !akhir || awal > akhir) return null;
    const metric: "penjualan" | "qty" = urut.startsWith("qty") ? "qty" : "penjualan";
    const terms = trenCari.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hari = rentangHari(awal, akhir);
    const idx = new Map(hari.map((t, i) => [t, i]));
    const rpH: number[] = Array(hari.length).fill(0), qtyH: number[] = Array(hari.length).fill(0);
    const pAkhir = tambahHari(awal, -1), pAwal = tambahHari(awal, -hari.length);
    let pRp = 0, pQty = 0, pAda = false;
    const cocok = new Set<string>();
    for (const b of semua.bulan) for (const r of b.rows) {
      if (!r.tanggal) continue;
      if (areaEff !== "ALL" && r.area !== areaEff) continue;
      if (kategoriEff !== "ALL" && r.kategori !== kategoriEff) continue;
      if (brandEff !== "ALL" && r.brand !== brandEff) continue;
      if (tokoEff !== "ALL" && r.pelanggan !== tokoEff) continue;
      if (terms.length > 0) {
        const hay = `${r.barang} ${r.brand}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) continue;
      }
      const i = idx.get(r.tanggal);
      if (i !== undefined) { rpH[i] += r.penjualan; qtyH[i] += r.qty; cocok.add(r.barang); }
      else if (r.tanggal >= pAwal && r.tanggal <= pAkhir) { pRp += r.penjualan; pQty += r.qty; pAda = true; }
    }
    const lintasTahun = awal.slice(0, 4) !== akhir.slice(0, 4);
    const labels = hari.map((t) => `${+t.slice(8)} ${NAMA_BULAN[+t.slice(5, 7) - 1].slice(0, 3)}${lintasTahun ? ` ${t.slice(2, 4)}` : ""}`);
    const dual = terms.length > 0;
    const config: ProdukTrenConfig = {
      labels, values: metric === "qty" ? qtyH : rpH, metric, harian: true,
      ...(dual ? { dual: { penjualan: rpH, qty: qtyH } } : {}),
    };
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const ket = `periode sebelumnya (${formatTanggal(pAwal)} s/d ${formatTanggal(pAkhir)})`;
    const delta = (now: number, prev: number): Delta =>
      pAda ? { dari: ket, ke: "periode ini", persen: prev === 0 ? null : ((now - prev) / Math.abs(prev)) * 100 } : null;
    return {
      config, awal, akhir, jumlahHari: hari.length, jumlahBarang: cocok.size, dual,
      totalRp: sum(rpH), totalQty: sum(qtyH),
      deltaRp: delta(sum(rpH), pRp), deltaQty: delta(sum(qtyH), pQty),
      delta: delta(sum(metric === "qty" ? qtyH : rpH), metric === "qty" ? pQty : pRp),
    };
  }, [semua, periodeAktif, dari, sampai, tglMin, tglMax, urut, trenCari, areaEff, kategoriEff, brandEff, tokoEff]);

  // Tren PER PRODUK pada rentang tanggal terpilih (tambahan). Produk teratas/terendah (ikut urutan) digambar
  // sebagai garis per hari, plus tabel ranking dengan perubahan vs periode sebelumnya yang sama panjang.
  // Ikut filter Area/Kategori/Brand/Toko dan kotak produk/brand tren (mis. ketik brand → produk milik brand itu).
  const trenProduk = useMemo(() => {
    if (!trenHarian || !semua) return null;
    const { awal, akhir } = trenHarian;
    const metric: "penjualan" | "qty" = urut.startsWith("qty") ? "qty" : "penjualan";
    const terms = trenCari.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hari = rentangHari(awal, akhir);
    const idx = new Map(hari.map((t, i) => [t, i]));
    const pAkhir = tambahHari(awal, -1), pAwal = tambahHari(awal, -hari.length);
    type Acc = { brand: string; rp: number[]; qty: number[]; totRp: number; totQty: number; pRp: number; pQty: number };
    const m = new Map<string, Acc>();
    let pAda = false;
    for (const b of semua.bulan) for (const r of b.rows) {
      if (!r.tanggal) continue;
      const i = idx.get(r.tanggal);
      const prev = i === undefined && r.tanggal >= pAwal && r.tanggal <= pAkhir;
      if (i === undefined && !prev) continue;
      if (areaEff !== "ALL" && r.area !== areaEff) continue;
      if (kategoriEff !== "ALL" && r.kategori !== kategoriEff) continue;
      if (brandEff !== "ALL" && r.brand !== brandEff) continue;
      if (tokoEff !== "ALL" && r.pelanggan !== tokoEff) continue;
      if (terms.length > 0) {
        const hay = `${r.barang} ${r.brand}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) continue;
      }
      let a = m.get(r.barang);
      if (!a) { a = { brand: r.brand, rp: Array(hari.length).fill(0), qty: Array(hari.length).fill(0), totRp: 0, totQty: 0, pRp: 0, pQty: 0 }; m.set(r.barang, a); }
      if (i !== undefined) { a.rp[i] += r.penjualan; a.qty[i] += r.qty; a.totRp += r.penjualan; a.totQty += r.qty; }
      else { a.pRp += r.penjualan; a.pQty += r.qty; pAda = true; }
    }
    const nilai = (a: Acc) => (metric === "qty" ? a.totQty : a.totRp);
    const urutan = [...m.entries()].filter(([, a]) => a.totRp !== 0 || a.totQty !== 0)
      .sort((x, y) => (urut.endsWith("desc") ? nilai(y[1]) - nilai(x[1]) : nilai(x[1]) - nilai(y[1])));
    const chart: ProdukMultiConfig = {
      labels: trenHarian.config.labels, metric,
      series: urutan.slice(0, TREN_PRODUK_GARIS).map(([name, a]) => ({ name, values: metric === "qty" ? a.qty : a.rp })),
    };
    const tabel = urutan.slice(0, TREN_PRODUK_TABEL).map(([name, a]) => ({ name, ...a }));
    return { chart, tabel, pAda, jumlah: urutan.length, metric };
  }, [trenHarian, semua, urut, trenCari, areaEff, kategoriEff, brandEff, tokoEff]);

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
            {periodeAktif
              ? <span className="ml-3 text-xl font-medium text-indigo-300">· {formatTanggal(dari || tglMin)} s/d {formatTanggal(sampai || tglMax)}</span>
              : bulanEff && <span className="ml-3 text-xl font-medium text-indigo-300">· {bulanEff === SEMUA_BULAN ? "Semua Bulan" : bulanEff}</span>}
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
        <DateRangePicker dari={dari} sampai={sampai} max={tglMax} adaData={tanggalAda}
          onChange={(a, b) => { setDari(a); setSampai(b); }} />
        <select value={urut} onChange={(e) => setUrut(e.target.value as Urut)} className={selectCls}>
          <option value="pj-desc">Penjualan tertinggi</option>
          <option value="pj-asc">Penjualan terendah</option>
          <option value="qty-desc">Qty terbanyak</option>
          <option value="qty-asc">Qty tersedikit</option>
        </select>
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang / pelanggan / kecamatan…"
          className="h-11 min-w-64 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-base text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60" />
      </div>

      {periodeAktif && (
        <p className="-mt-4 text-sm text-slate-400">
          Filter tanggal aktif: tabel, ringkasan, dan grafik per barang memakai data dari semua bulan pada rentang itu (pilihan bulan diabaikan).
          Tren bulanan tetap menampilkan Jan–Des.
        </p>
      )}

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

      {/* Tren per hari — muncul bila filter tanggal dipakai */}
      {trenHarian && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
            <Icn e="🗓️" className="h-4 w-4" />
            Tren {trenHarian.dual ? "penjualan & qty" : trenHarian.config.metric === "qty" ? "qty" : "penjualan"} per hari —{" "}
            <span className="text-indigo-300">
              {formatTanggal(trenHarian.awal)} s/d {formatTanggal(trenHarian.akhir)} ({trenHarian.jumlahHari} hari)
              {trenCari.trim() ? ` · ${trenHarian.jumlahBarang} barang cocok` : ""}
            </span>
          </p>
          <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span>Total periode:</span>
            <span>Penjualan <b className="text-emerald-300">{rp(trenHarian.totalRp)}</b></span>
            <span>Qty <b className="text-slate-200">{trenHarian.totalQty.toLocaleString("id-ID")}</b></span>
          </p>
          {trenHarian.dual ? (
            (trenHarian.deltaRp || trenHarian.deltaQty) && (
              <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                <span>vs {trenHarian.deltaRp?.dari ?? trenHarian.deltaQty?.dari}:</span>
                <span>Penjualan <Persen d={trenHarian.deltaRp} /></span>
                <span>Qty <Persen d={trenHarian.deltaQty} /></span>
              </p>
            )
          ) : trenHarian.delta && (
            <p className="mb-2 text-sm text-slate-400">vs {trenHarian.delta.dari}: <Persen d={trenHarian.delta} /></p>
          )}
          {trenCari.trim() && trenHarian.jumlahBarang === 0 ? (
            <p className="py-16 text-center text-slate-500">🔍 Tidak ada barang/brand yang cocok pada periode ini.</p>
          ) : (
            <ProdukTrenChart config={trenHarian.config} />
          )}
          <p className="mt-2 text-xs text-slate-500">
            Memakai kotak produk/brand di tren bulanan dan filter Area / Kategori / Brand / Toko. Hari tanpa transaksi dihitung 0; baris tanpa tanggal tidak ikut.
          </p>
        </div>
      )}

      {/* Tren per produk — muncul bila filter tanggal dipakai */}
      {trenHarian && trenProduk && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
            <Icn e="🏷️" className="h-4 w-4" />
            Tren {trenProduk.metric === "qty" ? "qty" : "penjualan"} per produk —{" "}
            <span className="text-indigo-300">
              {Math.min(TREN_PRODUK_GARIS, trenProduk.jumlah)} produk {urut.endsWith("desc") ? "tertinggi" : "terendah"} · {formatTanggal(trenHarian.awal)} s/d {formatTanggal(trenHarian.akhir)}
            </span>
          </p>
          {trenProduk.chart.series.length === 0 ? (
            <p className="py-16 text-center text-slate-500">🔍 Tidak ada penjualan produk pada periode ini.</p>
          ) : (
            <>
              <ProdukMultiTrenChart config={trenProduk.chart} />
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full whitespace-nowrap text-base">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-left text-sm uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Produk</th>
                      <th className="px-4 py-3 text-right font-semibold">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold">vs sebelumnya</th>
                      <th className="px-4 py-3 text-right font-semibold">Penjualan</th>
                      <th className="px-4 py-3 text-right font-semibold">vs sebelumnya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trenProduk.tabel.map((t, i) => (
                      <tr key={t.name} className="border-b border-white/5 transition-colors hover:bg-white/[0.06]">
                        <td className="px-4 py-3 tabular-nums text-slate-400">
                          {i < TREN_PRODUK_GARIS
                            ? <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: WARNA_PRODUK[i] }} />{i + 1}</span>
                            : i + 1}
                        </td>
                        <td className="max-w-[clamp(16rem,34vw,60rem)] px-4 py-3 font-medium">
                          <span className="flex items-center gap-2">
                            <BrandLogo brand={t.brand} size={24} />
                            <span className="truncate" title={t.name}>{t.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{t.totQty.toLocaleString("id-ID")}</td>
                        <td className="px-4 py-3 text-right tabular-nums"><Perubahan now={t.totQty} prev={t.pQty} ada={trenProduk.pAda} /></td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{rp(t.totRp)}</td>
                        <td className="px-4 py-3 text-right tabular-nums"><Perubahan now={t.totRp} prev={t.pRp} ada={trenProduk.pAda} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Garis = produk pada tabel dengan titik berwarna; urutan & metrik (qty / penjualan) mengikuti pilihan urutan. "vs sebelumnya" membandingkan dengan periode sebelumnya yang sama panjang;
            "baru" = belum ada penjualan di periode sebelumnya. Ketik brand/produk di kotak tren bulanan untuk mempersempit.
          </p>
        </div>
      )}

      {/* Tabel */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-base">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-sm uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5 font-semibold">Area</th>
                <th className="px-4 py-3 font-semibold">Kabupaten</th>
                <th className="px-4 py-3 font-semibold">Kecamatan</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Nama Barang</th>
                <th className="px-4 py-3 font-semibold">Pelanggan</th>
                <th className="px-4 py-3 font-semibold">Tanggal</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Penjualan</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">🔍 Tidak ada data yang cocok.</td></tr>
              )}
              {paged.map((r, i) => (
                <tr key={`${r.tanggal}-${r.area}-${r.pelanggan}-${r.barang}-${i}`}
                  className="border-b border-white/5 transition-colors hover:bg-white/[0.06]">
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-sm font-medium ${areaStyle(r.area)}`}>{r.area}</span></td>
                  <td className="whitespace-nowrap px-4 py-3">{r.kabupaten}</td>
                  <td className="whitespace-nowrap px-4 py-3">{r.kecamatan}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">{r.kategori}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <BrandLogo brand={r.brand} size={24} />
                      <span className="whitespace-nowrap">{r.brand}</span>
                    </span>
                  </td>
                  <td className="max-w-[clamp(16rem,34vw,60rem)] truncate px-4 py-3 font-medium" title={r.barang}>{r.barang}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">{r.pelanggan}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300 tabular-nums">{r.tanggal ? formatTanggal(r.tanggal) : "–"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.qty.toLocaleString("id-ID")}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${r.penjualan < 0 ? "text-rose-300" : ""}`}>{rp(r.penjualan)}</td>
                </tr>
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
