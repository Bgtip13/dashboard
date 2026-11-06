import { parseCsv } from "./csv";

/**
 * Data Penjualan Produk — satu tab (sheet) Google Sheet per bulan.
 *
 * Cara kerja:
 * 1. Spreadsheet di-publish ke web sebagai "Entire document" (bukan satu sheet saja),
 *    sehingga tiap tab bisa diambil lewat gid-nya.
 * 2. Daftar bulan diambil dari tab "INDEX" (kolom: Bulan | GID) bila
 *    NEXT_PUBLIC_SHEET_PRODUK_INDEX_GID diisi. Tambah bulan baru = tambah 1 baris
 *    di tab INDEX, tanpa deploy ulang. Kalau tidak diisi, dipakai BULAN_DEFAULT di bawah.
 * 3. Semua tab bulan wajib memakai urutan kolom yang sama:
 *    Area | Kabupaten | Kecamatan | Kategori | Brand | Nama Barang | Pelanggan | Qty | Penjualan
 */

// URL dasar publish-to-web (tanpa query). Bisa dioverride lewat .env.local
const DEFAULT_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7sB47BzQsD42E5WB424nbKUjS2kldryPZqc0_S5JTjiT2vQyxa8cCxKP-LXJ1Q_gD3T2ZALg46lIB/pub";
const BASE = (process.env.NEXT_PUBLIC_SHEET_PRODUK_BASE || DEFAULT_BASE).split("?")[0];
const INDEX_GID = (process.env.NEXT_PUBLIC_SHEET_PRODUK_INDEX_GID || "").trim();

export const SEMUA_BULAN = "SEMUA";

export type ProdukBulan = { label: string; gid: string };

/** Cadangan bila tab INDEX belum dibuat / gagal dibaca. Urutan: lama → baru. */
const BULAN_DEFAULT: ProdukBulan[] = [{ label: "Oktober 2026", gid: "1642504514" }];

export type ProdukRow = {
  bulan: string;
  area: string; kabupaten: string; kecamatan: string; kategori: string;
  brand: string; barang: string; pelanggan: string; qty: number; penjualan: number;
};
export type ProdukPayload = { updatedAt: string; rows: ProdukRow[]; gagal: string[] };

const toNum = (s: unknown) => {
  const n = Number(String(s ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Rapikan spasi ganda / spasi tak terlihat supaya tidak muncul dobel di filter. */
const teks = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

async function getCsv(gid: string): Promise<string[][]> {
  const url = `${BASE}?gid=${encodeURIComponent(gid)}&single=true&output=csv&_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal ambil data sheet (${res.status})`);
  return parseCsv(await res.text());
}

/** Daftar bulan dari tab INDEX. Baris header otomatis terlewat (GID-nya bukan angka). */
export async function fetchDaftarBulan(): Promise<ProdukBulan[]> {
  if (!INDEX_GID) return BULAN_DEFAULT;
  try {
    const vals = await getCsv(INDEX_GID);
    const list = vals
      .map((r) => ({ label: teks(r[0]), gid: teks(r[1]).replace(/\D/g, "") }))
      .filter((b) => b.label && b.gid);
    return list.length > 0 ? list : BULAN_DEFAULT;
  } catch {
    return BULAN_DEFAULT;
  }
}

/** Satu tab bulan → baris produk. */
export async function fetchProdukBulan(b: ProdukBulan): Promise<ProdukPayload> {
  const vals = await getCsv(b.gid);
  const rows: ProdukRow[] = vals.slice(1)
    .filter((r) => r.join("").trim() !== "")
    .map((r) => ({
      bulan: b.label,
      area: teks(r[0]).toUpperCase(),
      kabupaten: teks(r[1]),
      kecamatan: teks(r[2]),
      kategori: teks(r[3]),
      brand: teks(r[4]),
      barang: teks(r[5]),
      pelanggan: teks(r[6]),
      qty: toNum(r[7]),
      penjualan: toNum(r[8]),
    }));
  return { updatedAt: new Date().toISOString(), rows, gagal: [] };
}

/** Gabungan semua bulan. Bulan yang gagal dibaca dilewati dan dilaporkan di `gagal`. */
export async function fetchProdukSemua(list: ProdukBulan[]): Promise<ProdukPayload> {
  const hasil = await Promise.allSettled(list.map(fetchProdukBulan));
  const rows: ProdukRow[] = [];
  const gagal: string[] = [];
  hasil.forEach((h, i) => {
    if (h.status === "fulfilled") rows.push(...h.value.rows);
    else gagal.push(list[i].label);
  });
  if (rows.length === 0 && gagal.length > 0) throw new Error("Gagal ambil data sheet semua bulan");
  return { updatedAt: new Date().toISOString(), rows, gagal };
}
