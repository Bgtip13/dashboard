import type { DapRow } from "./types";

/** Filter utama: semua toko, ada transaksi, ada transaksi tapi di bawah target, atau tanpa transaksi */
export type TrxFilter = "ALL" | "AKTIF" | "BAWAH" | "TANPA";

/** Alasan toko tidak transaksi (dipakai saat filter = TANPA) */
export type Kategori = "AKTIF" | "BERHENTI" | "IDLE2" | "BELUM" | "TUTUP";
export type AlasanFilter = "ALL" | Exclude<Kategori, "AKTIF">;

export interface KategoriInfo {
  label: string;
  short: string;
  color: string;
  desc: string;
  /** true = target toko ini dihitung sebagai nominal hilang */
  rugi?: boolean;
}

export const KATEGORI: Record<Kategori, KategoriInfo> = {
  AKTIF: {
    label: "Ada transaksi",
    short: "Ada transaksi",
    color: "#34d399",
    desc: "Ada penjualan di bulan terpilih",
  },
  BERHENTI: {
    label: "Berhenti bulan ini",
    short: "Berhenti bln ini",
    color: "#fbbf24",
    desc: "Bulan sebelumnya masih transaksi, bulan terpilih 0",
    rugi: true,
  },
  IDLE2: {
    label: "Tidak order ≥ 2 bulan",
    short: "≥ 2 bln kosong",
    color: "#fb7185",
    desc: "Tidak transaksi bulan terpilih dan bulan sebelumnya",
    rugi: true,
  },
  BELUM: {
    label: "Belum pernah transaksi",
    short: "Belum pernah",
    color: "#60a5fa",
    desc: "Belum ada penjualan sampai bulan terpilih — dihitung sebagai potensi baru, bukan kerugian",
  },
  TUTUP: {
    label: "Tutup / DO NOT ORDER",
    short: "Tutup / DO",
    color: "#94a3b8",
    desc: "Toko tutup / tidak boleh order — tidak dihitung sebagai kerugian",
  },
};

/** Urutan tampil kategori non-aktif */
export const URUTAN_TANPA: Exclude<Kategori, "AKTIF">[] = ["BERHENTI", "IDLE2", "BELUM", "TUTUP"];

const TUTUP_RE = /DO\s*NOT|TUTUP|CLOSE|STOP|BERHENTI|NON\s*AKTIF/i;

export const isTutup = (r: DapRow) => TUTUP_RE.test(r.status);
export const aktualBulan = (r: DapRow, monthIdx: number) => r.bulanan[monthIdx] ?? 0;

/** Pernah transaksi sejak Januari s/d bulan `upto` (inklusif) */
export function pernahTransaksi(r: DapRow, upto: number): boolean {
  for (let i = 0; i <= upto && i < r.bulanan.length; i++) if ((r.bulanan[i] ?? 0) > 0) return true;
  return false;
}

/** Jumlah bulan kosong berturut-turut sampai bulan terpilih */
export function bulanKosong(r: DapRow, monthIdx: number): number {
  let n = 0;
  for (let i = monthIdx; i >= 0; i--) {
    if ((r.bulanan[i] ?? 0) > 0) break;
    n++;
  }
  return n;
}

export function kategori(r: DapRow, monthIdx: number): Kategori {
  if (aktualBulan(r, monthIdx) > 0) return "AKTIF";
  if (isTutup(r)) return "TUTUP";
  if (!pernahTransaksi(r, monthIdx)) return "BELUM";
  return bulanKosong(r, monthIdx) >= 2 ? "IDLE2" : "BERHENTI";
}

export const isKerugian = (k: Kategori) => k === "BERHENTI" || k === "IDLE2";

export interface Bucket {
  toko: number;
  target: number;
  aktual: number;
}

export interface Ringkasan {
  total: number;
  targetTotal: number;
  aktualTotal: number;
  perKategori: Record<Kategori, Bucket>;
  aktif: Bucket;
  tanpa: Bucket;
  /** Nominal hilang = target toko yang dulu aktif lalu berhenti (bukan tutup, bukan toko baru) */
  hilangToko: number;
  hilangNominal: number;
  /** % toko tanpa transaksi dari total toko */
  pctTokoTanpa: number;
  /** % target yang hilang dari total target */
  pctNominalHilang: number;
  bukanKerugianToko: number;
  bukanKerugianNominal: number;
  /** Toko yang bulan ini transaksi tapi belum mencapai target toko */
  bawahToko: number;
  /** Total kekurangan = Σ(target − aktual) dari toko di atas */
  bawahNominal: number;
  /** Toko yang bulan ini melampaui target toko */
  atasToko: number;
  /** Total kelebihan = Σ(aktual − target) — pengurang gap */
  atasNominal: number;
  /** Gap = total target − realisasi bulan ini */
  gapNominal: number;
}

/** Toko dihitung "di bawah target" hanya kalau punya target dan sudah transaksi bulan ini */
export function diBawahTarget(r: DapRow, monthIdx: number): boolean {
  if (r.targetToko <= 0) return false;
  const aktual = aktualBulan(r, monthIdx);
  return aktual > 0 && aktual < r.targetToko;
}

const bucket = (): Bucket => ({ toko: 0, target: 0, aktual: 0 });

export function ringkasSegmentasi(rows: DapRow[], monthIdx: number): Ringkasan {
  const perKategori: Record<Kategori, Bucket> = {
    AKTIF: bucket(), BERHENTI: bucket(), IDLE2: bucket(), BELUM: bucket(), TUTUP: bucket(),
  };
  const total = rows.length;
  let targetTotal = 0, aktualTotal = 0;
  let bawahToko = 0, bawahNominal = 0, atasToko = 0, atasNominal = 0;

  for (const r of rows) {
    const k = kategori(r, monthIdx);
    const aktual = aktualBulan(r, monthIdx);
    targetTotal += r.targetToko;
    aktualTotal += aktual;
    const b = perKategori[k];
    b.toko += 1;
    b.target += r.targetToko;
    b.aktual += aktual;

    // hanya toko yang bulan ini transaksi: yang 0 sudah masuk nominal hilang.
    // target 0 tapi ada penjualan tetap dihitung surplus supaya jumlah petak = gap.
    if (k === "AKTIF") {
      if (aktual < r.targetToko) { bawahToko += 1; bawahNominal += r.targetToko - aktual; }
      else { atasToko += 1; atasNominal += aktual - r.targetToko; }
    }
  }

  const aktif = { ...perKategori.AKTIF };
  const tanpa = bucket();
  for (const k of URUTAN_TANPA) {
    tanpa.toko += perKategori[k].toko;
    tanpa.target += perKategori[k].target;
    tanpa.aktual += perKategori[k].aktual;
  }

  let hilangToko = 0, hilangNominal = 0;
  for (const k of URUTAN_TANPA) {
    if (!isKerugian(k)) continue;
    hilangToko += perKategori[k].toko;
    hilangNominal += perKategori[k].target;
  }

  return {
    total,
    targetTotal,
    aktualTotal,
    perKategori,
    aktif,
    tanpa,
    hilangToko,
    hilangNominal,
    pctTokoTanpa: total ? (tanpa.toko / total) * 100 : 0,
    pctNominalHilang: targetTotal ? (hilangNominal / targetTotal) * 100 : 0,
    bukanKerugianToko: perKategori.BELUM.toko + perKategori.TUTUP.toko,
    bukanKerugianNominal: perKategori.BELUM.target + perKategori.TUTUP.target,
    bawahToko,
    bawahNominal,
    atasToko,
    atasNominal,
    gapNominal: targetTotal - aktualTotal,
  };
}

/**
 * Nominal hilang per bulan: target toko yang sudah pernah transaksi sebelum bulan itu,
 * tapi 0 di bulan tersebut (toko tutup & toko baru tidak dihitung).
 * Bulan setelah bulan terpilih dikosongkan karena belum terjadi.
 */
export function hilangPerBulan(rows: DapRow[], upto: number): number[] {
  return Array.from({ length: 12 }, (_, m) => {
    if (m > upto) return 0;
    let sum = 0;
    for (const r of rows) {
      if (aktualBulan(r, m) > 0 || isTutup(r) || !pernahTransaksi(r, m - 1)) continue;
      sum += r.targetToko;
    }
    return sum;
  });
}

export interface HilangKab { kabupaten: string; nominal: number; toko: number; }

/** Top kabupaten berdasarkan nominal hilang pada bulan terpilih */
export function hilangPerKabupaten(rows: DapRow[], monthIdx: number, limit = 8): HilangKab[] {
  const map = new Map<string, HilangKab>();
  for (const r of rows) {
    if (!isKerugian(kategori(r, monthIdx))) continue;
    const key = r.kabupaten || "TANPA KABUPATEN";
    const cur = map.get(key) ?? { kabupaten: key, nominal: 0, toko: 0 };
    cur.nominal += r.targetToko;
    cur.toko += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.nominal - a.nominal).slice(0, limit);
}
