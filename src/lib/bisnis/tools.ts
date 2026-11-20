/**
 * Daftar "alat" yang boleh dipanggil model (OpenAI Tool Calling) + dispatcher.
 * Whitelist ketat: semua alat read-only, argumen divalidasi, model tidak bisa
 * menjalankan kode atau query bebas. Angka dihitung engine, bukan model.
 */
import {
  analisisProduk, omzetRingkasan, profilToko, rankingToko, rekomendasiProduk,
  tokoPotensialProduk, trenBulanan,
  type DataBisnis, type HasilAlat, type JenisAnalisisProduk, type JenisPeriode, type Konteks, type MetrikRanking,
} from "./engine";

const PERIODE: readonly JenisPeriode[] = ["minggu_ini", "bulan_ini", "bulan_lalu"];
const ANALISIS: readonly JenisAnalisisProduk[] = ["naik", "turun", "terlaris", "terlambat", "baru", "berhenti", "naik_daun"];
const METRIK: readonly MetrikRanking[] = ["omzet", "pertumbuhan", "penurunan"];

const periodeProp = {
  type: "string", enum: PERIODE,
  description: "minggu_ini = Senin s/d hari ini vs periode sama minggu lalu; bulan_ini = tanggal 1 s/d hari ini vs rentang tanggal sama bulan lalu; bulan_lalu = bulan penuh vs bulan sebelumnya.",
};
const tokoProp = { type: "string", description: "Nama toko. Kosongkan jika yang dimaksud adalah toko yang sedang dibahas (konteks)." };

export const ALAT = [
  {
    name: "omzet_ringkasan",
    description: "Total omzet satu periode, dibandingkan periode setara sebelumnya (nominal & persen), jumlah toko naik/turun, rincian per area.",
    parameters: { type: "object", properties: { periode: periodeProp, area: { type: "string", description: "GLOBAL tidak berlaku; contoh SOLO/DIY/SEMARANG/TAB. Opsional." } }, required: ["periode"] },
  },
  {
    name: "ranking_toko",
    description: "Ranking toko berdasarkan omzet, kenaikan terbesar (pertumbuhan), atau penurunan terbesar, lengkap dengan nominal dan persen.",
    parameters: { type: "object", properties: { metrik: { type: "string", enum: METRIK }, periode: periodeProp, area: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 15 } }, required: ["metrik", "periode"] },
  },
  {
    name: "analisis_produk",
    description: "Analisis produk: naik, turun, terlaris, terlambat (paling lambat terjual), baru (mulai terjual + toko pembeli), berhenti (dibeli periode lalu, tidak sekarang), naik_daun. Isi toko untuk analisis di satu toko.",
    parameters: { type: "object", properties: { jenis: { type: "string", enum: ANALISIS }, periode: periodeProp, toko: tokoProp, area: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 15 } }, required: ["jenis"] },
  },
  {
    name: "profil_toko",
    description: "Profil satu toko: omzet per bulan (DAP), perubahan periode, dan PENYEBAB naik/turun berdasarkan kontribusi produk, produk yang berhenti dibeli.",
    parameters: { type: "object", properties: { toko: tokoProp, periode: periodeProp }, required: [] },
  },
  {
    name: "rekomendasi_produk",
    description: "Rekomendasi produk untuk ditawarkan ke satu toko, dengan alasan & bukti. Membedakan FAKTA (riwayat toko itu) dan PELUANG (pola toko lain, belum terbukti).",
    parameters: { type: "object", properties: { toko: tokoProp, limit: { type: "integer", minimum: 1, maximum: 10 } }, required: [] },
  },
  {
    name: "toko_potensial_produk",
    description: "Toko yang belum membeli suatu produk tetapi berpotensi membelinya (berdasarkan pembelian brand/kategori sama).",
    parameters: { type: "object", properties: { produk: { type: "string", description: "Nama produk. Kosongkan untuk produk yang sedang dibahas." }, limit: { type: "integer", minimum: 1, maximum: 15 } }, required: [] },
  },
  {
    name: "tren_bulanan",
    description: "Tren bulan ke bulan: omzet (DAP) seluruh toko atau satu toko; atau penjualan & qty satu produk (opsional di satu toko).",
    parameters: { type: "object", properties: { toko: tokoProp, produk: { type: "string", description: "Isi untuk tren produk." } }, required: [] },
  },
] as const;

export const ALAT_OPENAI = ALAT.map((a) => ({ type: "function" as const, function: a }));

const str = (v: unknown, n = 80): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim().slice(0, n);
  return s || undefined;
};
const enm = <T extends string>(v: unknown, list: readonly T[], def: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : def;
const lim = (v: unknown, def: number, max: number) => {
  const n = typeof v === "number" ? Math.floor(v) : def;
  return Math.min(max, Math.max(1, Number.isFinite(n) ? n : def));
};

const BUTUH_PRODUK = new Set(["analisis_produk", "rekomendasi_produk", "toko_potensial_produk"]);

export function jalankanAlat(nama: string, args: unknown, data: DataBisnis, konteks: Konteks): HasilAlat {
  const a = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
  const area = str(a.area, 20);
  if (area && area.toUpperCase() === "GLOBAL") delete a.area;
  const tokoArg = () => str(a.toko) ?? konteks.toko;
  const periode = () => enm(a.periode, PERIODE, enm(konteks.periode, PERIODE, "bulan_ini"));

  if (!data.dap && !data.produk) {
    return { ok: false, error: "Anda tidak punya akses ke data DAP maupun Produk, atau datanya belum bisa dibaca.", ringkasan: [] };
  }
  if (BUTUH_PRODUK.has(nama) && !data.produk) {
    return { ok: false, error: "Analisis ini butuh data tab Produk, yang tidak tersedia untuk akun ini / gagal dibaca.", ringkasan: [] };
  }

  try {
    switch (nama) {
      case "omzet_ringkasan":
        return omzetRingkasan(data, periode(), area && area.toUpperCase() !== "GLOBAL" ? area : undefined);
      case "ranking_toko":
        return rankingToko(data, {
          metrik: enm(a.metrik, METRIK, "omzet"), jenis: periode(),
          area: area && area.toUpperCase() !== "GLOBAL" ? area : undefined, limit: lim(a.limit, 5, 15),
        });
      case "analisis_produk":
        return analisisProduk(data, {
          jenis: enm(a.jenis, ANALISIS, "naik"), periode: periode(),
          toko: str(a.toko), area: area && area.toUpperCase() !== "GLOBAL" ? area : undefined, limit: lim(a.limit, 5, 15),
        });
      case "profil_toko": {
        const t = tokoArg();
        if (!t) return { ok: false, error: "Toko belum disebutkan. Tanyakan toko mana yang dimaksud.", ringkasan: [] };
        return profilToko(data, t, periode());
      }
      case "rekomendasi_produk": {
        const t = tokoArg();
        if (!t) return { ok: false, error: "Toko belum disebutkan. Tanyakan toko mana yang dimaksud.", ringkasan: [] };
        return rekomendasiProduk(data, t, lim(a.limit, 5, 10));
      }
      case "toko_potensial_produk": {
        const p = str(a.produk) ?? konteks.produk;
        if (!p) return { ok: false, error: "Produk belum disebutkan.", ringkasan: [] };
        return tokoPotensialProduk(data, p, lim(a.limit, 8, 15));
      }
      case "tren_bulanan":
        return trenBulanan(data, { toko: str(a.toko), produk: str(a.produk) });
      default:
        return { ok: false, error: `Alat "${nama}" tidak dikenal.`, ringkasan: [] };
    }
  } catch (e) {
    return { ok: false, error: `Gagal menghitung: ${(e as Error).message}`, ringkasan: [] };
  }
}
