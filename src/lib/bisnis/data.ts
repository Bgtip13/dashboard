/**
 * Pemuat data untuk analis (khusus server). Membaca tab DAP & PRODUK di Google Sheets,
 * di-cache di memori supaya tidak menembak Google di setiap pertanyaan.
 * Data mock TIDAK dipakai: kalau URL sheet belum diisi, sumber dianggap tidak tersedia.
 */
import { fetchDap } from "../api";
import { fetchProdukSemuaBulan, type ProdukRow } from "../produk";
import { hariIniWIB, type DataBisnis } from "./engine";
import type { DapRow } from "../types";

const TTL_MS = 5 * 60_000;

interface Cache {
  at: number;
  dap?: DapRow[];
  produk?: ProdukRow[];
  updatedAt: string;
  galat: string[];
}
let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

async function muat(): Promise<Cache> {
  const galat: string[] = [];
  const [dapRes, prodRes] = await Promise.allSettled([
    process.env.NEXT_PUBLIC_SHEET_DAP ? fetchDap() : Promise.reject(new Error("URL sheet DAP belum diisi")),
    fetchProdukSemuaBulan(),
  ]);
  let dap: DapRow[] | undefined;
  let produk: ProdukRow[] | undefined;
  if (dapRes.status === "fulfilled") dap = dapRes.value.rows;
  else galat.push(`DAP: ${(dapRes.reason as Error).message}`);
  if (prodRes.status === "fulfilled") produk = prodRes.value.bulan.flatMap((b) => b.rows);
  else galat.push(`PRODUK: ${(prodRes.reason as Error).message}`);
  return { at: Date.now(), dap, produk, updatedAt: new Date().toISOString(), galat };
}

export async function muatData(): Promise<Cache> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  if (!inflight) {
    inflight = muat()
      .then((c) => {
        // hanya simpan kalau ada minimal satu sumber; kalau gagal total, pakai cache lama bila ada
        if (c.dap || c.produk) cache = c;
        else if (cache) return cache;
        return c;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export interface Izin { dap: boolean; produk: boolean }

/** Data yang boleh dilihat pengguna (hak akses tab DAP / PRODUK). */
export function dataUntuk(c: Cache, izin: Izin): DataBisnis {
  return {
    dap: izin.dap ? c.dap : undefined,
    produk: izin.produk ? c.produk : undefined,
    hariIni: hariIniWIB(),
  };
}
