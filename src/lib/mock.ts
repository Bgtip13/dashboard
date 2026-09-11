import type { MonthlyPayload, WeeklyPayload } from "./types";

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

export const MOCK_WEEKLY: WeeklyPayload = {
  updatedAt: new Date().toISOString(),
  rows: [
    { jabatan: "SPV", area: "GLOBAL", nama: "BAGUS", targetPerMinggu: jt(290), act: [jt(1047.9), jt(1010.3), 0, 0, 0] },
    { jabatan: "ADM SALES", area: "SOLO", nama: "ADELIA | SURYA", targetPerMinggu: jt(67.5), act: [jt(138.4), jt(352), 0, 0, 0] },
    { jabatan: "ADM SALES", area: "DIY", nama: "APRIL | WAHYU", targetPerMinggu: jt(106), act: [jt(389.5), jt(217.7), 0, 0, 0] },
    { jabatan: "ADM SALES", area: "SEMARANG", nama: "FITRI | KRISNA", targetPerMinggu: jt(106.5), act: [jt(446.3), jt(401.3), 0, 0, 0] },
  ],
};
