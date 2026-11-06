import { parseCsv, parseNum } from "./csv";

/**
 * Data Penjualan Produk — satu tab Google Sheet per bulan, dikenali dari NAMA TAB:
 * Januari, Februari, Maret, … Desember (tahun = tahun berjalan).
 * Tab yang belum dibuat / masih kosong otomatis dilewati.
 *
 * Semua tab bulan wajib memakai urutan kolom yang sama:
 *   Area | Kabupaten | Kecamatan | Kategori | Brand | Nama Barang | Pelanggan | Qty | Penjualan
 *
 * Butuh ID spreadsheet asli (bukan kode 2PACX…) di NEXT_PUBLIC_SHEET_PRODUK_ID,
 * dan sharing "Anyone with the link → Viewer".
 */
const SHEET_ID = (process.env.NEXT_PUBLIC_SHEET_PRODUK_ID || "").trim();

export const SEMUA_BULAN = "SEMUA";
const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export type ProdukRow = {
  bulan: string;
  area: string; kabupaten: string; kecamatan: string; kategori: string;
  brand: string; barang: string; pelanggan: string; qty: number; penjualan: number;
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
    await new Promise((r) => setTimeout(r, 600)); // coba sekali lagi
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

function toRows(csv: string, label: string): ProdukRow[] {
  return parseCsv(csv).slice(1)
    .filter((r) => r.join("").trim() !== "")
    .map((r) => ({
      bulan: label,
      area: teks(r[0]).toUpperCase(),
      kabupaten: teks(r[1]),
      kecamatan: teks(r[2]),
      kategori: teks(r[3]),
      brand: teks(r[4]),
      barang: teks(r[5]),
      pelanggan: teks(r[6]),
      qty: parseNum(r[7]),
      penjualan: parseNum(r[8]),
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
  const palsu = await getCsvText("__tab_tidak_ada__");
  const hasil = await paralel(NAMA_BULAN, 3, getCsvText);

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
