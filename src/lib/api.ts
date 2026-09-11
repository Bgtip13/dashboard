import { parseCsv, parseNum } from "./csv";
import type { DapPayload, DapRow, MonthlyPayload, MonthlyRow, WeeklyPayload, WeeklyRow } from "./types";
import { MOCK_MONTHLY, MOCK_WEEKLY } from "./mock";

const MONTHLY_URL = process.env.NEXT_PUBLIC_SHEET_MONTHLY ?? "";
const WEEKLY_URL = process.env.NEXT_PUBLIC_SHEET_WEEKLY ?? "";
const DAP_URL = process.env.NEXT_PUBLIC_SHEET_DAP ?? "";

const norm = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function col(map: Record<string, number>, ...names: string[]) {
  for (const n of names) { const k = norm(n); if (k in map) return map[k]; }
  return -1;
}

async function getCsv(url: string): Promise<string[][] | null> {
  if (!url) return null;
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}_=${Date.now()}`);
  if (!res.ok) throw new Error(`Gagal ambil data sheet (${res.status})`);
  return parseCsv(await res.text());
}

// ---------- MONTHLY ----------
function toMonthly(vals: string[][]): MonthlyPayload {
  const map: Record<string, number> = {};
  (vals[0] ?? []).forEach((h, i) => { const k = norm(h); if (k && !(k in map)) map[k] = i; });
  const cJ = col(map, "JABATAN"), cA = col(map, "AREA"), cN = col(map, "NAMA SDM", "NAMA");
  const cT = col(map, "TGT", "TARGET"), cAc = col(map, "ACT", "AKTUAL");
  const cPo = col(map, "POTENSI TOKO"), cTa = col(map, "TA TOTAL");
  const cNo = col(map, "TA NOO"), cRe = col(map, "TOKO REAKTIF");
  const cTr = col(map, "TRIP"), cTk = col(map, "TRIP KUOTA");
  if (cN === -1) return { updatedAt: new Date().toISOString(), rows: [] };
  const rows: MonthlyRow[] = vals.slice(1)
    .filter((r) => String(r[cN] ?? "").trim() !== "")
    .map((r) => ({
      jabatan: cJ === -1 ? "" : String(r[cJ] ?? "").trim(),
      area: cA === -1 ? "" : String(r[cA] ?? "").trim().toUpperCase(),
      nama: String(r[cN] ?? "").trim(),
      target: cT === -1 ? 0 : parseNum(r[cT]),
      aktual: cAc === -1 ? 0 : parseNum(r[cAc]),
      potensi: cPo === -1 ? 0 : parseNum(r[cPo]),
      taTotal: cTa === -1 ? 0 : parseNum(r[cTa]),
      noo: cNo === -1 ? 0 : parseNum(r[cNo]),
      reaktif: cRe === -1 ? 0 : parseNum(r[cRe]),
      trip: cTr === -1 ? 0 : parseNum(r[cTr]),
      tripKuota: cTk === -1 ? 0 : parseNum(r[cTk]),
    }));
  return { updatedAt: new Date().toISOString(), rows };
}

// ---------- WEEKLY ----------
function toWeekly(vals: string[][]): WeeklyPayload {
  const map: Record<string, number> = {};
  const head = vals[0] ?? [];
  head.forEach((h, i) => { const k = norm(h); if (k && !(k in map)) map[k] = i; });
  const cJ = col(map, "JABATAN"), cA = col(map, "AREA"), cN = col(map, "NAMA SDM", "NAMA");
  const cT = col(map, "TGT/MGG", "TGTMGG", "TGT PER MINGGU", "TGT");
  if (cN === -1) return { updatedAt: new Date().toISOString(), rows: [] };
  const cM = [1, 2, 3, 4, 5].map((i) => {
    for (let j = 0; j < head.length; j++) {
      if (String(head[j] ?? "").includes("%")) continue;
      const n = norm(head[j]);
      if (n === `ACTM${i}` || n === `M${i}`) return j;
    }
    return -1;
  });
  const rows: WeeklyRow[] = vals.slice(1)
    .filter((r) => String(r[cN] ?? "").trim() !== "")
    .map((r) => ({
      jabatan: cJ === -1 ? "" : String(r[cJ] ?? "").trim(),
      area: cA === -1 ? "" : String(r[cA] ?? "").trim().toUpperCase(),
      nama: String(r[cN] ?? "").trim(),
      targetPerMinggu: cT === -1 ? 0 : parseNum(r[cT]),
      act: cM.map((c) => (c === -1 ? 0 : parseNum(r[c]))),
    }));
  return { updatedAt: new Date().toISOString(), rows };
}

// ---------- DAP (header 2 baris: nama bulan di baris kedua) ----------
const MONTH_PREFIX: [string, number][] = [
  ["JAN", 0], ["FEB", 1], ["MAR", 2], ["APR", 3], ["MEI", 4], ["JUN", 5],
  ["JUL", 6], ["AGU", 7], ["SEP", 8], ["OKT", 9], ["NOV", 10], ["DES", 11],
];
function monthIndex(headerCell: string): number {
  const n = norm(headerCell);
  if (!n) return -1;
  const hit = MONTH_PREFIX.find(([p]) => n.startsWith(p));
  return hit ? hit[1] : -1;
}

function toDap(vals: string[][]): DapPayload {
  let h = vals.findIndex((r) => r.some((c) => norm(c) === "AREA") && r.some((c) => norm(c) === "KABUPATEN"));
  if (h === -1) h = 0;
  const head = vals[h] ?? [];
  const map: Record<string, number> = {};
  head.forEach((c, i) => { const k = norm(c); if (k && !(k in map)) map[k] = i; });

  let dataStart = h + 1;
  let monthCols = Array(12).fill(-1);
  const nextRow = vals[h + 1] ?? [];
  const monthHits = nextRow.map((c, j) => ({ m: monthIndex(c), j })).filter((x) => x.m !== -1);
  if (monthHits.length >= 3) {
    dataStart = h + 2;
    monthHits.forEach(({ m, j }) => { monthCols[m] = j; });
  } else {
    head.forEach((c, j) => { const m = monthIndex(c); if (m !== -1 && monthCols[m] === -1) monthCols[m] = j; });
  }

  const cArea = col(map, "AREA"), cKab = col(map, "KABUPATEN"), cKec = col(map, "KECAMATAN");
  const cToko = col(map, "PELANGGAN", "TOKO", "NAMA TOKO");
  const cAdm = col(map, "ADM");
  const kelasIdx = head.map((c, i) => (norm(c) === "KELAS" ? i : -1)).filter((i) => i !== -1);
  const cKT = kelasIdx[0] ?? -1, cKB = kelasIdx[1] ?? -1;
  const cYtd = col(map, "TOTAL OMSET", "OMSET"), cTgt = col(map, "TARGET TOKO", "TARGET");
  const cStatus = col(map, "STATUS TOKO", "STATUS"), cPasif = col(map, "BULAN PASIF", "BULAN");
  if (cToko === -1) return { updatedAt: new Date().toISOString(), rows: [] };

  const rows: DapRow[] = vals.slice(dataStart)
    .filter((r) => String(r[cToko] ?? "").trim() !== "")
    .map((r) => ({
      area: cArea === -1 ? "" : String(r[cArea] ?? "").trim().toUpperCase(),
      kabupaten: cKab === -1 ? "" : String(r[cKab] ?? "").trim(),
      kecamatan: cKec === -1 ? "" : String(r[cKec] ?? "").trim(),
      toko: String(r[cToko] ?? "").trim(),
      pelanggan: 0,
      adm: cAdm === -1 ? "" : String(r[cAdm] ?? "").trim(),
      kelasToko: cKT === -1 ? "" : String(r[cKT] ?? "").trim(),
      kelasByr: cKB === -1 ? "" : String(r[cKB] ?? "").trim(),
      bulanan: monthCols.map((c) => (c === -1 ? 0 : parseNum(r[c]))),
      omsetYtd: cYtd === -1 ? 0 : parseNum(r[cYtd]),
      targetToko: cTgt === -1 ? 0 : parseNum(r[cTgt]),
      status: cStatus === -1 ? "" : String(r[cStatus] ?? "").trim(),
      bulanPasif: cPasif === -1 ? "" : String(r[cPasif] ?? "").trim(),
    }));
  return { updatedAt: new Date().toISOString(), rows };
}

// ---------- API ----------
export const fetchMonthly = async (): Promise<MonthlyPayload> => {
  const vals = await getCsv(MONTHLY_URL);
  return vals ? toMonthly(vals) : MOCK_MONTHLY;
};
export const fetchWeekly = async (): Promise<WeeklyPayload> => {
  const vals = await getCsv(WEEKLY_URL);
  return vals ? toWeekly(vals) : MOCK_WEEKLY;
};
export const fetchDap = async (): Promise<DapPayload> => {
  const vals = await getCsv(DAP_URL);
  return vals ? toDap(vals) : { updatedAt: "", rows: [] };
};
