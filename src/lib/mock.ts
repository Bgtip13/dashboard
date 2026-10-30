import type { DapPayload, DapRow, MonthlyPayload, WeeklyPayload } from "./types";

export const MOCK_MONTHLY: MonthlyPayload = {
  updatedAt: new Date().toISOString(),
  rows: [
    { jabatan: "SPV", area: "GLOBAL", nama: "BAGUS", target: 5800000000, aktual: 2058279785, potensi: 792, taTotal: 369, noo: 10, reaktif: 2, trip: 9, tripKuota: 26 },
    { jabatan: "ADM SALES", area: "SOLO", nama: "ADELIA | SURYA", target: 1350000000, aktual: 490378543, potensi: 203, taTotal: 95, noo: 1, reaktif: 2, trip: 3, tripKuota: 8 },
    { jabatan: "ADM SALES", area: "DIY", nama: "APRIL | WAHYU", target: 2120000000, aktual: 607193000, potensi: 324, taTotal: 138, noo: 3, reaktif: 0, trip: 3, tripKuota: 9 },
    { jabatan: "ADM SALES", area: "SEMARANG", nama: "FITRI | KRISNA", target: 2130000000, aktual: 847542402, potensi: 245, taTotal: 128, noo: 6, reaktif: 0, trip: 3, tripKuota: 9 },
    { jabatan: "TABUNGAN", area: "TAB", nama: "UMUM & CABANG", target: 200000000, aktual: 113165840, potensi: 20, taTotal: 8, noo: 0, reaktif: 0, trip: 0, tripKuota: 0 },
  ],
};

const jt = (n: number) => n * 1_000_000;

/**
 * DAP demo: dipakai kalau NEXT_PUBLIC_SHEET_DAP belum diisi, supaya beranda dan
 * halaman DAP tetap bisa dipakai. Data dibangkitkan deterministik (bukan random
 * tiap render) dengan pola stabil / turun / kosong / target besar kosong / naik.
 */
const AREA_WILAYAH: [string, string, string][] = [
  ["SEMARANG", "SEMARANG", "GAJAHMUNGKUR"],
  ["SEMARANG", "KENDAL", "NGALIYAN"],
  ["SEMARANG", "DEMAK", "MRANGGEN"],
  ["SEMARANG", "SALATIGA", "ARGOMULYO"],
  ["SOLO", "SURAKARTA", "BANJARSARI"],
  ["SOLO", "SUKOHARJO", "GROGOL"],
  ["SOLO", "KLATEN", "DELANGGU"],
  ["SOLO", "BOYOLALI", "TERAS"],
  ["DIY", "YOGYAKARTA", "GONDOKUSUMAN"],
  ["DIY", "SLEMAN", "DEPOK"],
  ["DIY", "BANTUL", "BANGUNTAPAN"],
  ["DIY", "GUNUNGKIDUL", "WONOSARI"],
];

const AWALAN_TOKO = ["Apotek", "Toko", "Kios", "Warung", "Mini Market", "Grosir", "Sentra"];
const NAMA_TOKO = ["Sehat", "Sentosa", "Mulia", "Berkah", "Jaya", "Makmur", "Anugrah", "Sinar", "Sumber", "Amanah", "Keluarga", "Barokah"];

function buatDapMock(): DapPayload {
  let seed = 20260214;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const sampai = new Date().getMonth();
  const rows: DapRow[] = [];

  AREA_WILAYAH.forEach(([area, kabupaten, kecamatan], wi) => {
    for (let i = 0; i < 4; i++) {
      const n = rows.length + 1;
      const pola = n % 5; // 1 turun · 2 kosong · 3 target besar kosong · 4 naik · 0 stabil
      const targetToko = Math.round((500_000 + rnd() * 3_500_000) / 50_000) * 50_000;
      const bulanan = Array.from({ length: 12 }, (_, m) => {
        if (m > sampai) return 0;
        const dasar = targetToko * (0.75 + rnd() * 0.6);
        if (pola === 2) return m === sampai ? 0 : Math.round(dasar);
        if (pola === 3) return m === sampai ? 0 : Math.round(dasar * 0.85);
        if (pola === 1) return m === sampai ? Math.round(dasar * 0.35) : Math.round(dasar);
        if (pola === 4) return m === sampai ? Math.round(dasar * 1.2) : Math.round(dasar);
        return Math.round(dasar);
      });
      rows.push({
        area,
        kabupaten,
        kecamatan,
        toko: `${pick(AWALAN_TOKO)} ${pick(NAMA_TOKO)} ${kecamatan.slice(0, 3)} ${i + 1}`,
        pelanggan: 0,
        adm: `ADM ${(wi % 3) + 1}`,
        kelasToko: pick(["A", "B", "C"]),
        kelasByr: pick(["CASH", "KREDIT"]),
        bulanan,
        omsetYtd: bulanan.reduce((s, v) => s + v, 0),
        targetToko,
        status: pola === 2 || pola === 3 ? "PASIF" : "LANCAR",
        bulanPasif: pola === 2 || pola === 3 ? "1 BULAN" : "",
      });
    }
  });

  return { updatedAt: new Date().toISOString(), rows };
}

export const MOCK_DAP: DapPayload = buatDapMock();

export const MOCK_WEEKLY: WeeklyPayload = {
  updatedAt: new Date().toISOString(),
  rows: [
    { jabatan: "SPV", area: "GLOBAL", nama: "BAGUS", targetPerMinggu: jt(290), act: [jt(1047.9), jt(1010.3), 0, 0, 0] },
    { jabatan: "ADM SALES", area: "SOLO", nama: "ADELIA | SURYA", targetPerMinggu: jt(67.5), act: [jt(138.4), jt(352), 0, 0, 0] },
    { jabatan: "ADM SALES", area: "DIY", nama: "APRIL | WAHYU", targetPerMinggu: jt(106), act: [jt(389.5), jt(217.7), 0, 0, 0] },
    { jabatan: "ADM SALES", area: "SEMARANG", nama: "FITRI | KRISNA", targetPerMinggu: jt(106.5), act: [jt(446.3), jt(401.3), 0, 0, 0] },
  ],
};
