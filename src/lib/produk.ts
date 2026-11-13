import { parseCsv, parseNum } from "./csv";

/**
 * Data Penjualan Produk — satu tab Google Sheet per bulan, dikenali dari NAMA TAB:
 * Januari, Februari, Maret, … Desember (tahun = tahun berjalan).
 * Tab yang belum dibuat / masih kosong otomatis dilewati.
 *
 * Urutan kolom (baris 1 = header):
 *   Area | Kabupaten | Kecamatan | Kategori | Brand | Nama Barang | Pelanggan | Tanggal | Kuantitas | Penjualan
 *
 * Kolom dibaca berdasarkan NAMA HEADER (bukan urutan), jadi aman kalau kolom bergeser.
 * Tab bulan yang belum punya kolom Tanggal (susunan lama, 9 kolom: …Pelanggan | Qty | Penjualan)
 * tetap terbaca — baris-barisnya hanya tidak punya tanggal.
 *
 * Butuh ID spreadsheet asli (bukan kode 2PACX…) di NEXT_PUBLIC_SHEET_PRODUK_ID,
 * dan sharing "Anyone with the link → Viewer".
 */
const SHEET_ID = (process.env.NEXT_PUBLIC_SHEET_PRODUK_ID || "").trim();

export const SEMUA_BULAN = "SEMUA";
export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export type ProdukRow = {
  bulan: string;
  area: string; kabupaten: string; kecamatan: string; kategori: string;
  brand: string; barang: string; pelanggan: string;
  /** Format ISO "YYYY-MM-DD"; kosong "" bila tab belum punya kolom Tanggal / selnya kosong */
  tanggal: string;
  qty: number; penjualan: number;
};
export type ProdukBulanData = { label: string; rows: ProdukRow[] };
export type ProdukSemua = { updatedAt: string; bulan: ProdukBulanData[]; catatan: string[] };

/** Rapikan spasi ganda / spasi tak terlihat supaya tidak muncul dobel di filter. */
const teks = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

type Ambil = { text: string | null; status: string };

async function getCsvText(namaTab: string): Promise<Ambil> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(namaTab)}&_=${Date.now()}`;
  let status = "gagal";
  for (let coba = 0; coba < 2; coba++) {
    try {
      const res = await fetch(url);
      if (res.ok) return { text: await res.text(), status: "ok" };
      status = `HTTP ${res.status}`;
    } catch {
      status = "koneksi/akses ditolak";
    }
    await new Promise((r) => setTimeout(r, 300)); // coba sekali lagi
  }
  return { text: null, status };
}

/** Jalankan maksimal `n` permintaan bersamaan supaya tidak dibatasi Google. */
async function paralel<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

const norm = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const NAMA_BULAN_PREFIX: [string, number][] = [
  ["JAN", 1], ["FEB", 2], ["MAR", 3], ["APR", 4], ["MEI", 5], ["MAY", 5], ["JUN", 6],
  ["JUL", 7], ["AGU", 8], ["AUG", 8], ["SEP", 9], ["OKT", 10], ["OCT", 10], ["NOV", 11], ["DES", 12], ["DEC", 12],
];

function isoTanggal(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Ubah isi sel tanggal jadi "YYYY-MM-DD" (tanpa zona waktu, jadi tidak bergeser sehari).
 * Dikenali: 04-11-2026 · 04/11/2026 · 4.11.26 (hari-bulan-tahun) · 2026-11-04 · "4 Nov 2026" · serial Sheets.
 */
export function parseTanggal(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return isoTanggal(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return isoTanggal(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})/);
  if (m) {
    const bln = NAMA_BULAN_PREFIX.find(([p]) => m![2].toUpperCase().startsWith(p));
    return bln ? isoTanggal(+m[3], bln[1], +m[1]) : "";
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) { // nomor seri tanggal Google Sheets
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(parseFloat(s)) * 86400000);
    return isoTanggal(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return "";
}

/** "2026-11-04" -> "04-11-2026" (sama dengan tampilan di Google Sheet) */
export function formatTanggal(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** Tambah/kurangi hari pada tanggal ISO (aman zona waktu). */
export function tambahHari(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Semua tanggal dari `awal` sampai `akhir` (inklusif), berurutan. */
export function rentangHari(awal: string, akhir: string): string[] {
  const out: string[] = [];
  for (let t = awal; t <= akhir && out.length < 800; t = tambahHari(t, 1)) out.push(t);
  return out;
}

function toRows(csv: string, label: string): ProdukRow[] {
  const all = parseCsv(csv);
  // Baris header = baris pertama (dalam 5 baris awal) yang memuat "Nama Barang" / "Pelanggan"
  let h = all.slice(0, 5).findIndex((r) => r.some((c) => ["NAMABARANG", "PELANGGAN"].includes(norm(c))));
  if (h === -1) h = 0;
  const map: Record<string, number> = {};
  (all[h] ?? []).forEach((c, i) => { const k = norm(c); if (k && !(k in map)) map[k] = i; });
  const adaHeader = "NAMABARANG" in map || "PELANGGAN" in map;

  // Cadangan bila nama header tidak ketemu: susunan baru (ada Tanggal) atau susunan lama (tanpa Tanggal)
  const susunanBaru = !adaHeader || "TANGGAL" in map;
  const fb = susunanBaru ? { tgl: 7, qty: 8, pj: 9 } : { tgl: -1, qty: 7, pj: 8 };
  const idx = (names: string[], cadangan: number) => {
    for (const n of names) { const k = norm(n); if (k in map) return map[k]; }
    return cadangan;
  };
  const cArea = idx(["AREA"], 0), cKab = idx(["KABUPATEN"], 1), cKec = idx(["KECAMATAN"], 2);
  const cKat = idx(["KATEGORI"], 3), cBrand = idx(["BRAND"], 4), cBarang = idx(["NAMA BARANG", "BARANG"], 5);
  const cPel = idx(["PELANGGAN", "TOKO"], 6), cTgl = idx(["TANGGAL", "TGL"], fb.tgl);
  const cQty = idx(["KUANTITAS", "QTY", "QUANTITY", "JUMLAH"], fb.qty);
  const cPj = idx(["PENJUALAN", "OMSET"], fb.pj);
  const at = (r: string[], c: number) => (c < 0 ? "" : r[c]);

  return all.slice(h + 1)
    .filter((r) => r.join("").trim() !== "")
    .map((r) => ({
      bulan: label,
      area: teks(at(r, cArea)).toUpperCase(),
      kabupaten: teks(at(r, cKab)),
      kecamatan: teks(at(r, cKec)),
      kategori: teks(at(r, cKat)),
      brand: teks(at(r, cBrand)),
      barang: teks(at(r, cBarang)),
      pelanggan: teks(at(r, cPel)),
      tanggal: parseTanggal(at(r, cTgl)),
      qty: parseNum(at(r, cQty)),
      penjualan: parseNum(at(r, cPj)),
    }));
}

/**
 * Ambil semua tab bulan yang ada.
 * Catatan: Google diam-diam mengembalikan tab PERTAMA bila nama tab tidak ditemukan.
 * Maka nama tab palsu diminta dulu sebagai "sidik jari"; tab bulan yang isinya sama
 * dengannya dianggap tidak ada. Akibatnya tab pertama di spreadsheet jangan tab bulan.
 */
export async function fetchProdukSemuaBulan(): Promise<ProdukSemua> {
  if (!SHEET_ID) throw new Error("NEXT_PUBLIC_SHEET_PRODUK_ID belum diisi (ID spreadsheet)");
  const now = new Date();
  const tahun = now.getFullYear();
  // Bulan yang belum tiba tidak perlu diminta ke Google (hemat permintaan & waktu tunggu).
  // Sidik jari + semua bulan berjalan diambil BERSAMAAN, bukan berurutan.
  const bulanDiminta = NAMA_BULAN.slice(0, now.getMonth() + 1);
  const [palsu, hasilAda] = await Promise.all([
    getCsvText("__tab_tidak_ada__"),
    paralel(bulanDiminta, 6, getCsvText),
  ]);
  const hasil: Ambil[] = NAMA_BULAN.map((_, i) => hasilAda[i] ?? { text: null, status: "belum tiba" });

  const bulan: ProdukBulanData[] = [];
  const catatan: string[] = [];
  NAMA_BULAN.forEach((nama, i) => {
    const { text, status } = hasil[i];
    let alasan = "";
    if (!text) alasan = `gagal dibaca (${status})`;
    else if (palsu.text && text === palsu.text) alasan = "tab tidak ditemukan";
    else {
      const label = `${nama} ${tahun}`;
      const rows = toRows(text, label);
      if (rows.length > 0) { bulan.push({ label, rows }); return; }
      alasan = "tab kosong / belum ada baris data";
    }
    // bulan yang belum tiba tidak perlu dilaporkan
    if (i <= now.getMonth()) catatan.push(`${nama}: ${alasan}`);
  });
  if (bulan.length === 0) {
    throw new Error(`Tab bulan tidak terbaca. ${catatan.join("; ")}`);
  }
  return { updatedAt: now.toISOString(), bulan, catatan };
}
