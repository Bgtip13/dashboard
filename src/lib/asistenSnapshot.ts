/**
 * Ringkasan data dashboard untuk F.R.I.D.A.Y.
 *
 * Dibuat di klien dari cache react-query lalu dikirim ke /api/asisten, sehingga
 * pertanyaan angka ("berapa pencapaian bulan ini?") bisa dijawab langsung —
 * oleh model maupun parser bawaan — tanpa harus membuka halaman.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { AsistenResult } from "./asisten";
import { ringkasSegmentasi, ringkasTren, teratasTurun } from "./dapSegment";
import type { DapRow, MonthlyRow } from "./types";

export interface ProdukCacheRow {
  brand: string;
  barang: string;
  penjualan: number;
  qty?: number;
}

export interface SnapshotArea {
  nama: string;
  target: number;
  aktual: number;
  pcp: number;
}

export interface SnapshotTokoTurun {
  nama: string;
  kabupaten: string;
  sekarang: number;
  sebelumnya: number;
  selisih: number;
}

export interface AsistenSnapshot {
  periode: string;
  bulan: number;
  bulanan?: { target: number; aktual: number; pcp: number; area: SnapshotArea[] };
  toko?: {
    total: number;
    tanpaTransaksi: number;
    bawahTarget: number;
    hilangNominal: number;
    /** jumlah toko yang omsetnya turun / naik vs bulan lalu */
    turun?: number;
    naik?: number;
    turunNominal?: number;
    topTurun?: SnapshotTokoTurun[];
  };
  produk?: {
    brand: { nama: string; penjualan: number }[];
    barang: { nama: string; penjualan: number }[];
  };
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const angka = (n: number) => Math.round(n).toLocaleString("id-ID");
const rupiah = (n: number) => `Rp${angka(n)}`;
const persen = (n: number) => `${n.toFixed(1).replace(".", ",")} persen`;

function topBy<T>(items: T[], key: (item: T) => string, value: (item: T) => number, limit: number) {
  const map = new Map<string, number>();
  for (const item of items) {
    const nama = key(item).trim();
    if (!nama) continue;
    map.set(nama, (map.get(nama) ?? 0) + value(item));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nama, penjualan]) => ({ nama, penjualan }));
}

export function buildSnapshot(qc: QueryClient, now = new Date()): AsistenSnapshot | null {
  const dap = qc.getQueryData<{ rows?: DapRow[] }>(["dap"]);
  const monthly = qc.getQueryData<{ rows?: MonthlyRow[] }>(["monthly"]);
  const produk = qc.getQueryData<{ rows?: ProdukCacheRow[] }>(["produk"]);

  const bulan = now.getMonth();
  const snap: AsistenSnapshot = { periode: `${MONTHS[bulan]} ${now.getFullYear()}`, bulan };

  // Baris per-SDM dijumlahkan per area (baris GLOBAL dilewati agar tidak dobel).
  const mrows = (monthly?.rows ?? []).filter((r) => r.area && r.area !== "GLOBAL");
  if (mrows.length > 0) {
    const perArea = new Map<string, { target: number; aktual: number }>();
    let target = 0;
    let aktual = 0;
    for (const r of mrows) {
      target += r.target;
      aktual += r.aktual;
      const cur = perArea.get(r.area) ?? { target: 0, aktual: 0 };
      cur.target += r.target;
      cur.aktual += r.aktual;
      perArea.set(r.area, cur);
    }
    snap.bulanan = {
      target,
      aktual,
      pcp: target ? (aktual / target) * 100 : 0,
      area: [...perArea.entries()]
        .map(([nama, v]) => ({
          nama,
          target: v.target,
          aktual: v.aktual,
          pcp: v.target ? (v.aktual / v.target) * 100 : 0,
        }))
        .sort((a, b) => b.aktual - a.aktual),
    };
  }

  const drows = dap?.rows ?? [];
  if (drows.length > 0) {
    const ringkas = ringkasSegmentasi(drows, bulan);
    const tren = ringkasTren(drows, bulan);
    snap.toko = {
      total: ringkas.total,
      tanpaTransaksi: ringkas.tanpa.toko,
      bawahTarget: ringkas.bawahToko,
      hilangNominal: ringkas.hilangNominal,
      turun: tren.turun,
      naik: tren.naik,
      turunNominal: tren.turunNominal,
      topTurun: teratasTurun(drows, bulan, 5).map((t) => ({
        nama: t.toko,
        kabupaten: t.kabupaten,
        sekarang: t.aktual,
        sebelumnya: t.sebelumnya,
        selisih: t.selisih,
      })),
    };
  }

  const prows = produk?.rows ?? [];
  if (prows.length > 0) {
    snap.produk = {
      brand: topBy(prows, (r) => r.brand, (r) => r.penjualan, 3),
      barang: topBy(prows, (r) => r.barang, (r) => r.penjualan, 3),
    };
  }

  if (!snap.bulanan && !snap.toko && !snap.produk) return null;
  return snap;
}

const AREA_ALIASES: Record<string, string> = {
  jogja: "DIY", jogjakarta: "DIY", yogyakarta: "DIY", yogya: "DIY", diy: "DIY",
  smg: "SEMARANG", semarang: "SEMARANG", solo: "SOLO", surakarta: "SOLO",
};

function matchArea(tokens: string[], areas: string[]): string | null {
  for (const area of areas) if (tokens.includes(area.toLowerCase())) return area;
  for (const [alias, area] of Object.entries(AREA_ALIASES)) {
    if (tokens.includes(alias) && areas.includes(area)) return area;
  }
  return null;
}

const TRX_WORDS = ["tanpa", "tidak", "gak", "nggak", "belum", "pasif", "idle", "hilang", "kosong", "sepi", "berhenti"];
const METRIK_WORDS = ["omset", "penjualan", "pcp", "pencapaian", "target", "aktual", "realisasi", "performa"];
const TREN_TURUN_WORDS = [
  "turun", "menurun", "penurunan", "turunnya", "anjlok", "merosot", "melorot",
  "menyusut", "melemah", "lesu", "drop", "decline",
];
const TREN_NAIK_WORDS = ["naik", "kenaikan", "meningkat", "meningkatnya", "tumbuh", "growth"];

/** Jawab pertanyaan angka dari data yang sudah termuat (tanpa model). */
export function answerFromSnapshot(raw: string, snap: AsistenSnapshot): AsistenResult | null {
  const tokens = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!tokens.length) return null;

  const has = (words: string[]) => words.some((w) => tokens.includes(w));
  const asksPcp = has(["pcp", "pencapaian", "performa", "target", "aktual", "realisasi", "capai", "capaian", "omset", "penjualan", "gauge", "%"]);
  const asksToko = has(["toko", "outlet", "transaksi", "order", "churn", "pasif"]);
  const asksProduk = has(["produk", "brand", "merek", "barang", "sku", "terlaris"]);

  // Pertanyaan tren ("berapa toko yang turun bulan ini?") dijawab dari ringkasan tren.
  if (snap.toko && (has(TREN_TURUN_WORDS) || has(TREN_NAIK_WORDS))) {
    const s = snap.toko;
    const turun = has(TREN_TURUN_WORDS);
    const jumlah = (turun ? s.turun : s.naik) ?? 0;
    const nominal = turun ? (s.turunNominal ?? 0) : 0;
    const top = turun ? (s.topTurun ?? []).slice(0, 3) : [];
    const detail = top.length
      ? ` Terparah: ${top.map((t) => `${t.nama} (turun ${rupiah(Math.abs(t.selisih))})`).join(", ")}.`
      : "";
    return {
      reply: `Ada ${angka(jumlah)} toko ${turun ? "turun" : "naik"} di ${snap.periode}${nominal > 0 ? `, total penurunan ${rupiah(nominal)}` : ""}.${detail}`,
      action: {
        page: "dap",
        params: {
          bulan: String(snap.bulan),
          tren: turun ? "TURUN" : "NAIK",
          urut: "selisih",
          arah: turun ? "asc" : "desc",
        },
      },
      source: "rule",
    };
  }

  // Pertanyaan tentang toko (bukan omset/pencapaian) dijawab dengan angka segmentasi.
  if (asksToko && !has(METRIK_WORDS) && snap.toko) {
    const s = snap.toko;
    const tanpa = has(TRX_WORDS);
    const alasan = has(["berhenti"])
      ? "BERHENTI"
      : has(["pasif", "idle"])
        ? "IDLE2"
        : has(["belum"])
          ? "BELUM"
          : has(["tutup", "nonaktif", "do"])
            ? "TUTUP"
            : "ALL";
    const params: Record<string, string> = { bulan: String(snap.bulan) };
    if (tanpa) {
      params.trx = "TANPA";
      params.alasan = alasan;
    }
    return {
      reply: `Ada ${angka(s.total)} toko. ${angka(s.tanpaTransaksi)} toko tanpa transaksi di ${snap.periode}${s.hilangNominal > 0 ? `, nominal hilang ${rupiah(s.hilangNominal)}` : ""}. ${angka(s.bawahTarget)} toko sudah transaksi tapi masih di bawah target.`,
      action: { page: "dap", params },
      source: "rule",
    };
  }

  if (asksPcp && !asksProduk && snap.bulanan) {
    const area = matchArea(tokens, snap.bulanan.area.map((a) => a.nama));
    const scope = area ? snap.bulanan.area.find((a) => a.nama === area)! : snap.bulanan;
    if (scope.target <= 0 && scope.aktual <= 0) return null;

    const sorted = [...snap.bulanan.area].filter((a) => a.target > 0).sort((a, b) => b.pcp - a.pcp);
    const tail = !area && sorted.length >= 2
      ? ` Tertinggi ${sorted[0].nama} ${persen(sorted[0].pcp)}, terendah ${sorted[sorted.length - 1].nama} ${persen(sorted[sorted.length - 1].pcp)}.`
      : "";
    return {
      reply: `${area ? `Area ${area}` : "Total semua area"} ${snap.periode}: PCP ${persen(scope.pcp)}, aktual ${rupiah(scope.aktual)} dari target ${rupiah(scope.target)}.${tail}`,
      action: { page: "bulanan", params: area ? { area } : {} },
      source: "rule",
    };
  }

  if (asksProduk && snap.produk) {
    const { brand, barang } = snap.produk;
    const parts: string[] = [];
    if (barang[0]) parts.push(`barang teratas ${barang[0].nama} dengan penjualan ${rupiah(barang[0].penjualan)}`);
    if (brand[0]) parts.push(`brand teratas ${brand[0].nama} (${rupiah(brand[0].penjualan)})`);
    if (!parts.length) return null;
    return {
      reply: `Dari data produk yang sudah termuat: ${parts.join(", ")}.`,
      action: { page: "produk", params: {} },
      source: "rule",
    };
  }

  return null;
}
