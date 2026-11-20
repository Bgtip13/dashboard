/**
 * Business Analysis Engine — semua hitungan nominal, persen, periode, ranking, dan
 * rekomendasi dilakukan di sini (backend), BUKAN oleh model AI.
 * Fungsi murni: input data sheet → hasil terstruktur. Read-only, tanpa efek samping.
 *
 * Sumber data:
 *  • DAP    : omzet per toko per BULAN (tidak ada tanggal)  → perbandingan bulan penuh.
 *  • PRODUK : transaksi (tanggal, pelanggan, barang, qty, penjualan) → mingguan, MTD setara,
 *             analisis produk, dan rekomendasi.
 * Zona waktu: Asia/Jakarta.
 */
import type { DapRow } from "../types";
import type { ProdukRow } from "../produk";

// ---------------------------------------------------------------- tipe publik
export interface Tampilan {
  tabel?: { judul: string; kolom: string[]; baris: string[][] };
  grafik?: {
    judul: string;
    jenis: "bar" | "line";
    satuan: "rp" | "qty";
    label: string[];
    seri: { nama: string; nilai: number[] }[];
  };
}

export interface Konteks {
  toko?: string;
  produk?: string;
  periode?: string;
  topik?: string;
  daftarToko?: string[];
}

export interface HasilAlat {
  ok: boolean;
  error?: string;
  /** Kalimat ringkas yang sudah final (angka dari backend). Dipakai juga sebagai jawaban cadangan. */
  ringkasan: string[];
  data?: unknown;
  tampilan?: Tampilan;
  konteks?: Partial<Konteks>;
}

export interface DataBisnis {
  dap?: DapRow[];
  produk?: ProdukRow[];
  /** "YYYY-MM-DD" menurut WIB */
  hariIni: string;
}

export type JenisPeriode = "minggu_ini" | "bulan_ini" | "bulan_lalu";

// ---------------------------------------------------------------- util umum
export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const daysIn = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
const parseIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m0: m - 1, d };
};
export function addDays(s: string, n: number): string {
  const { y, m0, d } = parseIso(s);
  return new Date(Date.UTC(y, m0, d + n)).toISOString().slice(0, 10);
}
/** Senin = 0 … Minggu = 6 */
const dow = (s: string) => {
  const { y, m0, d } = parseIso(s);
  return (new Date(Date.UTC(y, m0, d)).getUTCDay() + 6) % 7;
};

/** Tanggal hari ini menurut WIB. */
export function hariIniWIB(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export const rp = (n: number) => `${n < 0 ? "-" : ""}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
const angka = (n: number) => Math.round(n).toLocaleString("id-ID");
export const persenTeks = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const tumbuh = (now: number, prev: number): number | null => (prev > 0 ? ((now - prev) / prev) * 100 : null);
const tandaPct = (p: number | null) => (p === null ? "baru/tanpa pembanding" : `${p >= 0 ? "+" : ""}${persenTeks(p)}`);
const selisihTeks = (s: number) => `${s >= 0 ? "+" : "-"}${rp(Math.abs(s))}`;

export const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const bulanIdx = (label: string) => NAMA_BULAN.findIndex((n) => label.startsWith(n));
const cut = (s: string, n = 28) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ---------------------------------------------------------------- periode setara
export interface Periode { label: string; awal: string; akhir: string }
export interface PeriodePair {
  jenis: JenisPeriode;
  sekarang: Periode;
  sebelumnya: Periode | null;
  /** MTD/WTD: panjang hari sama; bulan penuh vs bulan penuh juga setara */
  setara: boolean;
  nama: string;
  catatan: string[];
}

const fmtTgl = (s: string) => {
  const { y, m0, d } = parseIso(s);
  return `${d} ${NAMA_BULAN[m0].slice(0, 3)} ${y}`;
};
const rentangLabel = (a: string, b: string) => (a === b ? fmtTgl(a) : `${fmtTgl(a)} – ${fmtTgl(b)}`);

export function periodeUntuk(jenis: JenisPeriode, hariIni: string): PeriodePair {
  const { y, m0, d } = parseIso(hariIni);
  const catatan: string[] = [];

  if (jenis === "minggu_ini") {
    const senin = addDays(hariIni, -dow(hariIni));
    const hariKe = dow(hariIni) + 1;
    return {
      jenis, setara: true, catatan,
      nama: `minggu ini (Senin–${["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][dow(hariIni)]}, ${hariKe} hari)`,
      sekarang: { label: rentangLabel(senin, hariIni), awal: senin, akhir: hariIni },
      sebelumnya: {
        label: rentangLabel(addDays(senin, -7), addDays(hariIni, -7)),
        awal: addDays(senin, -7), akhir: addDays(hariIni, -7),
      },
    };
  }

  if (jenis === "bulan_ini") {
    const pm = m0 - 1;
    let sebelumnya: Periode | null = null;
    if (pm >= 0) {
      const akhirD = Math.min(d, daysIn(y, pm));
      sebelumnya = {
        label: rentangLabel(isoOf(y, pm, 1), isoOf(y, pm, akhirD)),
        awal: isoOf(y, pm, 1), akhir: isoOf(y, pm, akhirD),
      };
    } else catatan.push("Tidak ada data Desember tahun lalu, jadi tidak ada pembanding.");
    return {
      jenis, setara: sebelumnya !== null, catatan,
      nama: `bulan ini (tanggal 1–${d} ${NAMA_BULAN[m0]})`,
      sekarang: { label: rentangLabel(isoOf(y, m0, 1), hariIni), awal: isoOf(y, m0, 1), akhir: hariIni },
      sebelumnya,
    };
  }

  // bulan_lalu: bulan penuh vs bulan penuh sebelumnya
  const lm = m0 - 1;
  if (lm < 0) {
    return {
      jenis, setara: false, catatan: ["Bulan lalu jatuh di tahun sebelumnya; data tahun lalu tidak tersedia."],
      nama: "bulan lalu", sekarang: { label: "Desember (tahun lalu)", awal: "", akhir: "" }, sebelumnya: null,
    };
  }
  const pm = lm - 1;
  return {
    jenis, setara: true, catatan,
    nama: `bulan lalu (${NAMA_BULAN[lm]} penuh)`,
    sekarang: { label: `${NAMA_BULAN[lm]} ${y}`, awal: isoOf(y, lm, 1), akhir: isoOf(y, lm, daysIn(y, lm)) },
    sebelumnya: pm >= 0
      ? { label: `${NAMA_BULAN[pm]} ${y}`, awal: isoOf(y, pm, 1), akhir: isoOf(y, pm, daysIn(y, pm)) }
      : null,
  };
}

// ---------------------------------------------------------------- identitas toko & produk
interface InfoToko { key: string; nama: string; area: string; kabupaten: string; kelas: string }

export function daftarToko(d: DataBisnis): Map<string, InfoToko> {
  const m = new Map<string, InfoToko>();
  for (const r of d.dap ?? []) {
    const key = normKey(r.toko);
    if (key && !m.has(key)) m.set(key, { key, nama: r.toko, area: r.area, kabupaten: r.kabupaten, kelas: r.kelasToko });
  }
  for (const r of d.produk ?? []) {
    const key = normKey(r.pelanggan);
    if (key && !m.has(key)) m.set(key, { key, nama: r.pelanggan, area: r.area, kabupaten: r.kabupaten, kelas: "" });
  }
  return m;
}

export type CariToko = { toko: InfoToko } | { ambigu: string[] } | { tidakAda: true };

export function cariToko(d: DataBisnis, q: string): CariToko {
  const nq = normKey(q);
  if (!nq) return { tidakAda: true };
  const semua = [...daftarToko(d).values()];
  const exact = semua.find((t) => t.key === nq);
  if (exact) return { toko: exact };
  const tokens = nq.split(" ").filter(Boolean);
  const cocok = semua.filter((t) => tokens.every((tk) => t.key.includes(tk)));
  if (cocok.length === 1) return { toko: cocok[0] };
  if (cocok.length > 1) {
    const awal = cocok.filter((t) => t.key.startsWith(nq));
    if (awal.length === 1) return { toko: awal[0] };
    return { ambigu: cocok.slice(0, 8).map((t) => t.nama) };
  }
  return { tidakAda: true };
}

export type CariProduk = { barang: string } | { ambigu: string[] } | { tidakAda: true };

export function cariProduk(d: DataBisnis, q: string): CariProduk {
  const nq = normKey(q);
  if (!nq) return { tidakAda: true };
  const nama = new Map<string, string>();
  for (const r of d.produk ?? []) {
    const k = normKey(r.barang);
    if (k && !nama.has(k)) nama.set(k, r.barang);
  }
  if (nama.has(nq)) return { barang: nama.get(nq)! };
  const tokens = nq.split(" ").filter(Boolean);
  const cocok = [...nama.entries()].filter(([k]) => tokens.every((t) => k.includes(t)));
  if (cocok.length === 1) return { barang: cocok[0][1] };
  if (cocok.length > 1) return { ambigu: cocok.slice(0, 8).map(([, v]) => v) };
  return { tidakAda: true };
}

// ---------------------------------------------------------------- transaksi per periode
interface Transaksi {
  sekarang: ProdukRow[];
  sebelumnya: ProdukRow[];
  setara: boolean;
  pair: PeriodePair;
  catatan: string[];
}

const adaTanggal = (r: ProdukRow) => r.tanggal !== "";
const dalam = (r: ProdukRow, p: Periode | null) => !!p && adaTanggal(r) && r.tanggal >= p.awal && r.tanggal <= p.akhir;

/** Proporsi baris ber-tanggal pada bulan-bulan yang disentuh periode. */
function cakupanTanggal(rows: ProdukRow[], p: Periode | null): number {
  if (!p || !p.awal) return 1;
  const bulan = new Set([parseIso(p.awal).m0, parseIso(p.akhir).m0]);
  const sub = rows.filter((r) => bulan.has(bulanIdx(r.bulan)));
  if (sub.length === 0) return 1;
  return sub.filter(adaTanggal).length / sub.length;
}

/**
 * Ambil transaksi periode sekarang vs pembanding setara.
 * Bila tanggal tidak lengkap, bulan_ini jatuh ke total bulan (tanda setara=false).
 */
export function ambilTransaksi(d: DataBisnis, jenis: JenisPeriode): Transaksi | { error: string } {
  const rows = d.produk;
  if (!rows || rows.length === 0) return { error: "Data PRODUK tidak tersedia." };
  const pair = periodeUntuk(jenis, d.hariIni);
  const catatan = [...pair.catatan];
  if (!pair.sebelumnya) return { sekarang: [], sebelumnya: [], setara: false, pair, catatan };

  const lengkap = cakupanTanggal(rows, pair.sekarang) >= 0.95 && cakupanTanggal(rows, pair.sebelumnya) >= 0.95;
  if (lengkap) {
    return {
      sekarang: rows.filter((r) => dalam(r, pair.sekarang)),
      sebelumnya: rows.filter((r) => dalam(r, pair.sebelumnya)),
      setara: true, pair, catatan,
    };
  }
  if (jenis === "minggu_ini") {
    return { error: "Kolom Tanggal di tab PRODUK belum lengkap, jadi perbandingan mingguan tidak bisa dihitung akurat." };
  }
  // fallback: total bulan (bulan berjalan sebagian vs bulan lalu penuh)
  const m0 = parseIso(jenis === "bulan_ini" ? d.hariIni : pair.sekarang.awal).m0;
  const now = rows.filter((r) => bulanIdx(r.bulan) === m0);
  const prev = rows.filter((r) => bulanIdx(r.bulan) === m0 - 1);
  catatan.push(
    "Kolom Tanggal belum lengkap, jadi dipakai total per bulan" +
    (jenis === "bulan_ini" ? " (bulan berjalan baru sebagian vs bulan lalu penuh) — perbandingan BELUM setara." : "."),
  );
  return { sekarang: now, sebelumnya: prev, setara: jenis !== "bulan_ini", pair, catatan };
}

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const inArea = (area: string | undefined) => (r: { area: string }) => !area || r.area === area.toUpperCase();

// ---------------------------------------------------------------- omzet per toko (basis DAP / PRODUK)
export interface TokoPer {
  key: string; nama: string; area: string; kabupaten: string;
  sekarang: number; sebelumnya: number; selisih: number; pct: number | null;
}
interface PerTokoHasil { rows: TokoPer[]; basis: string; setara: boolean; catatan: string[]; pair: PeriodePair }

/** Hitung omzet per toko untuk periode + pembanding. DAP dipakai untuk bulan_lalu (bulan penuh). */
export function perToko(d: DataBisnis, jenis: JenisPeriode, area?: string): PerTokoHasil | { error: string } {
  const info = daftarToko(d);
  const pair = periodeUntuk(jenis, d.hariIni);
  const catatan = [...pair.catatan];
  const m0 = parseIso(d.hariIni).m0;
  const f = inArea(area);

  const dapOk = !!d.dap && d.dap.length > 0;
  const pakaiDap = dapOk && (jenis === "bulan_lalu" || !d.produk?.length);

  if (pakaiDap && jenis !== "minggu_ini") {
    const idx = jenis === "bulan_ini" ? m0 : m0 - 1;
    if (idx < 1 && jenis === "bulan_lalu" && idx < 0) return { error: "Bulan lalu di luar data tahun ini." };
    const rows: TokoPer[] = [];
    for (const r of d.dap!.filter(f)) {
      const now = r.bulanan[idx] ?? 0;
      const prev = idx > 0 ? r.bulanan[idx - 1] ?? 0 : 0;
      rows.push({
        key: normKey(r.toko), nama: r.toko, area: r.area, kabupaten: r.kabupaten,
        sekarang: now, sebelumnya: prev, selisih: now - prev, pct: tumbuh(now, prev),
      });
    }
    const berjalan = jenis === "bulan_ini";
    if (berjalan) catatan.push("Basis DAP: bulan berjalan baru sebagian dibanding bulan lalu penuh — BELUM setara.");
    return {
      rows, setara: !berjalan, catatan, pair,
      basis: `DAP (${NAMA_BULAN[idx]} vs ${idx > 0 ? NAMA_BULAN[idx - 1] : "-"})`,
    };
  }

  if (!d.produk?.length) return { error: "Data PRODUK tidak tersedia untuk periode ini." };
  const t = ambilTransaksi(d, jenis);
  if ("error" in t) return t;
  const acc = new Map<string, TokoPer>();
  const ambil = (r: ProdukRow) => {
    const key = normKey(r.pelanggan);
    let x = acc.get(key);
    if (!x) {
      const i = info.get(key);
      x = { key, nama: i?.nama ?? r.pelanggan, area: i?.area ?? r.area, kabupaten: i?.kabupaten ?? r.kabupaten, sekarang: 0, sebelumnya: 0, selisih: 0, pct: null };
      acc.set(key, x);
    }
    return x;
  };
  for (const r of t.sekarang.filter(f)) ambil(r).sekarang += r.penjualan;
  for (const r of t.sebelumnya.filter(f)) ambil(r).sebelumnya += r.penjualan;
  const rows = [...acc.values()].map((x) => ({ ...x, selisih: x.sekarang - x.sebelumnya, pct: tumbuh(x.sekarang, x.sebelumnya) }));
  return {
    rows, setara: t.setara, catatan: [...catatan, ...t.catatan], pair,
    basis: `PRODUK (${t.pair.sekarang.label} vs ${t.pair.sebelumnya?.label ?? "-"})`,
  };
}

// ---------------------------------------------------------------- 1. ringkasan omzet
export function omzetRingkasan(d: DataBisnis, jenis: JenisPeriode, area?: string): HasilAlat {
  const h = perToko(d, jenis, area);
  if ("error" in h) return { ok: false, error: h.error, ringkasan: [] };
  const pair = h.pair;
  if (!pair.sebelumnya) return { ok: false, error: pair.catatan[0] ?? "Tidak ada pembanding.", ringkasan: [] };

  const now = sum(h.rows, (r) => r.sekarang);
  const prev = sum(h.rows, (r) => r.sebelumnya);
  const sel = now - prev;
  const naik = h.rows.filter((r) => r.sebelumnya > 0 && r.sekarang > r.sebelumnya).length;
  const turun = h.rows.filter((r) => r.sebelumnya > 0 && r.sekarang < r.sebelumnya).length;
  const berhenti = h.rows.filter((r) => r.sebelumnya > 0 && r.sekarang === 0).length;
  const barutrx = h.rows.filter((r) => r.sebelumnya === 0 && r.sekarang > 0).length;

  const ring = [
    `Omzet ${pair.nama}${area ? ` area ${area.toUpperCase()}` : ""}: ${rp(now)} (${pair.sekarang.label}).`,
    `Pembanding ${pair.sebelumnya.label}: ${rp(prev)}. Selisih ${selisihTeks(sel)} (${tandaPct(tumbuh(now, prev))}).`,
    `Toko naik: ${angka(naik)}, turun: ${angka(turun)} (di antaranya ${angka(berhenti)} berhenti total), baru bertransaksi: ${angka(barutrx)}.`,
    `Sumber: ${h.basis}.${h.setara ? "" : " Perbandingan belum setara."}`,
  ];

  const perArea = new Map<string, { s: number; p: number }>();
  for (const r of h.rows) {
    const a = perArea.get(r.area || "-") ?? { s: 0, p: 0 };
    a.s += r.sekarang; a.p += r.sebelumnya;
    perArea.set(r.area || "-", a);
  }
  const baris = [...perArea.entries()].sort((a, b) => b[1].s - a[1].s).map(([a, v]) => [
    a, rp(v.s), rp(v.p), selisihTeks(v.s - v.p), tandaPct(tumbuh(v.s, v.p)),
  ]);
  baris.push(["TOTAL", rp(now), rp(prev), selisihTeks(sel), tandaPct(tumbuh(now, prev))]);

  return {
    ok: true, ringkasan: [...ring, ...h.catatan],
    data: { periode: pair.nama, sekarang: now, sebelumnya: prev, selisih: sel, persen: tumbuh(now, prev), sumber: h.basis, setara: h.setara, tokoNaik: naik, tokoTurun: turun, tokoBerhenti: berhenti, tokoBaru: barutrx },
    tampilan: {
      tabel: { judul: `Omzet per area — ${pair.nama}`, kolom: ["Area", "Sekarang", "Pembanding", "Selisih", "%"], baris },
      grafik: { judul: "Omzet sekarang vs pembanding", jenis: "bar", satuan: "rp", label: [...perArea.keys()], seri: [
        { nama: "Pembanding", nilai: [...perArea.values()].map((v) => Math.round(v.p)) },
        { nama: "Sekarang", nilai: [...perArea.values()].map((v) => Math.round(v.s)) },
      ] },
    },
    konteks: { periode: jenis, topik: "omzet" },
  };
}

// ---------------------------------------------------------------- 2. ranking toko
export type MetrikRanking = "omzet" | "pertumbuhan" | "penurunan";

export function rankingToko(
  d: DataBisnis, o: { metrik: MetrikRanking; jenis: JenisPeriode; area?: string; limit: number },
): HasilAlat {
  const h = perToko(d, o.jenis, o.area);
  if ("error" in h) return { ok: false, error: h.error, ringkasan: [] };
  if (!h.pair.sebelumnya) return { ok: false, error: h.pair.catatan[0] ?? "Tidak ada pembanding.", ringkasan: [] };

  let rows = h.rows;
  if (o.metrik === "omzet") rows = rows.filter((r) => r.sekarang > 0).sort((a, b) => b.sekarang - a.sekarang);
  else if (o.metrik === "pertumbuhan") rows = rows.filter((r) => r.selisih > 0).sort((a, b) => b.selisih - a.selisih);
  else rows = rows.filter((r) => r.selisih < 0).sort((a, b) => a.selisih - b.selisih);
  const total = rows.length;
  const top = rows.slice(0, o.limit);
  if (top.length === 0) {
    return { ok: true, ringkasan: [`Tidak ada toko yang memenuhi kriteria ${o.metrik} untuk ${h.pair.nama}.`, ...h.catatan], data: [] };
  }

  const judul = { omzet: "Ranking omzet toko", pertumbuhan: "Toko dengan kenaikan terbesar", penurunan: "Toko dengan penurunan terbesar" }[o.metrik];
  const ring = [
    `${judul} — ${h.pair.nama}, sumber ${h.basis}${h.setara ? "" : " (belum setara)"}.`,
    `Ada ${angka(total)} toko yang masuk kriteria. Teratas: ${top[0].nama} (${o.metrik === "omzet" ? rp(top[0].sekarang) : `${selisihTeks(top[0].selisih)}, ${tandaPct(top[0].pct)}`}).`,
  ];
  if (o.metrik === "penurunan") ring.push(`Total penurunan seluruh toko yang turun: ${rp(sum(rows, (r) => r.selisih))}.`);

  return {
    ok: true, ringkasan: [...ring, ...h.catatan],
    data: top.map((r) => ({ toko: r.nama, area: r.area, kabupaten: r.kabupaten, sekarang: r.sekarang, sebelumnya: r.sebelumnya, selisih: r.selisih, persen: r.pct })),
    tampilan: {
      tabel: {
        judul: `${judul} (${h.pair.nama})`,
        kolom: ["#", "Toko", "Sekarang", "Pembanding", "Selisih", "%"],
        baris: top.map((r, i) => [String(i + 1), cut(r.nama), rp(r.sekarang), rp(r.sebelumnya), selisihTeks(r.selisih), tandaPct(r.pct)]),
      },
      grafik: {
        judul: judul, jenis: "bar", satuan: "rp", label: top.map((r) => cut(r.nama, 14)),
        seri: o.metrik === "omzet"
          ? [{ nama: "Omzet", nilai: top.map((r) => Math.round(r.sekarang)) }]
          : [{ nama: "Selisih", nilai: top.map((r) => Math.round(r.selisih)) }],
      },
    },
    konteks: { toko: top[0].nama, daftarToko: top.map((r) => r.nama), periode: o.jenis, topik: o.metrik === "penurunan" ? "penurunan_omzet" : "ranking" },
  };
}

// ---------------------------------------------------------------- agregasi produk
interface AggBarang { barang: string; brand: string; kategori: string; qty: number; penjualan: number; toko: Set<string> }
function aggBarang(rows: ProdukRow[]): Map<string, AggBarang> {
  const m = new Map<string, AggBarang>();
  for (const r of rows) {
    const k = normKey(r.barang);
    if (!k) continue;
    let a = m.get(k);
    if (!a) { a = { barang: r.barang, brand: r.brand, kategori: r.kategori, qty: 0, penjualan: 0, toko: new Set() }; m.set(k, a); }
    a.qty += r.qty; a.penjualan += r.penjualan; a.toko.add(normKey(r.pelanggan));
  }
  return m;
}

/** Bulan pertama (0-11) sebuah barang muncul di seluruh data. */
function pertamaMuncul(rows: ProdukRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = normKey(r.barang); const b = bulanIdx(r.bulan);
    if (!k || b < 0 || (r.penjualan <= 0 && r.qty <= 0)) continue;
    if (!m.has(k) || b < m.get(k)!) m.set(k, b);
  }
  return m;
}

export type JenisAnalisisProduk = "naik" | "turun" | "terlaris" | "terlambat" | "baru" | "berhenti" | "naik_daun";

export function analisisProduk(
  d: DataBisnis, o: { jenis: JenisAnalisisProduk; periode: JenisPeriode; toko?: string; area?: string; limit: number },
): HasilAlat {
  let tokoKey = ""; let tokoNama = "";
  if (o.toko) {
    const c = cariToko(d, o.toko);
    if ("ambigu" in c) return { ok: false, error: `Nama toko ambigu: ${c.ambigu.join("; ")}`, ringkasan: [] };
    if ("tidakAda" in c) return { ok: false, error: `Toko "${o.toko}" tidak ditemukan.`, ringkasan: [] };
    tokoKey = c.toko.key; tokoNama = c.toko.nama;
  }
  const t = ambilTransaksi(d, o.periode);
  if ("error" in t) return { ok: false, error: t.error, ringkasan: [] };
  if (!t.pair.sebelumnya) return { ok: false, error: t.pair.catatan[0] ?? "Tidak ada pembanding.", ringkasan: [] };

  const f = inArea(o.area);
  const saring = (rs: ProdukRow[]) => rs.filter((r) => f(r) && (!tokoKey || normKey(r.pelanggan) === tokoKey));
  const now = aggBarang(saring(t.sekarang));
  const prev = aggBarang(saring(t.sebelumnya));
  const keys = new Set([...now.keys(), ...prev.keys()]);
  const mulai = pertamaMuncul(d.produk ?? []);
  const m0 = parseIso(d.hariIni).m0;
  const bulanPeriode = o.periode === "bulan_lalu" ? m0 - 1 : m0;

  interface Brs { b: AggBarang; s: number; p: number; sq: number; pq: number; sel: number; pct: number | null; toko: number }
  const semua: Brs[] = [...keys].map((k) => {
    const a = now.get(k); const b = prev.get(k); const ref = (a ?? b)!;
    const s = a?.penjualan ?? 0; const p = b?.penjualan ?? 0;
    return { b: ref, s, p, sq: a?.qty ?? 0, pq: b?.qty ?? 0, sel: s - p, pct: tumbuh(s, p), toko: a?.toko.size ?? 0 };
  });

  let hasil: Brs[]; let judul: string;
  switch (o.jenis) {
    case "naik": hasil = semua.filter((x) => x.p > 0 && x.sel > 0).sort((a, b) => b.sel - a.sel); judul = "Produk naik"; break;
    case "turun": hasil = semua.filter((x) => x.p > 0 && x.sel < 0).sort((a, b) => a.sel - b.sel); judul = "Produk turun"; break;
    case "terlaris": hasil = semua.filter((x) => x.s > 0).sort((a, b) => b.s - a.s); judul = "Produk terlaris"; break;
    case "terlambat": hasil = semua.filter((x) => x.s > 0).sort((a, b) => a.sq - b.sq || a.s - b.s); judul = "Produk paling lambat terjual"; break;
    case "baru": hasil = semua.filter((x) => x.s > 0 && x.p === 0 && mulai.get(normKey(x.b.barang)) === bulanPeriode).sort((a, b) => b.toko - a.toko || b.s - a.s); judul = "Produk baru mulai terjual"; break;
    case "berhenti": hasil = semua.filter((x) => x.p > 0 && x.s === 0).sort((a, b) => b.p - a.p); judul = "Produk berhenti/tidak dibeli di periode ini"; break;
    default: // naik_daun: pertumbuhan tinggi dan dibeli lebih dari satu toko
      hasil = semua.filter((x) => x.s > 0 && x.toko >= 2 && ((x.p > 0 && (x.pct ?? 0) >= 25) || (x.p === 0 && mulai.get(normKey(x.b.barang)) === bulanPeriode)))
        .sort((a, b) => (b.pct ?? 1e9) - (a.pct ?? 1e9) || b.s - a.s);
      judul = "Produk naik daun (naik ≥25% & dibeli ≥2 toko, atau baru)";
  }

  const lingkup = tokoNama ? ` di ${tokoNama}` : o.area ? ` area ${o.area.toUpperCase()}` : "";
  if (hasil.length === 0) {
    return { ok: true, ringkasan: [`Tidak ada data untuk "${judul}"${lingkup} pada ${t.pair.nama}.`, ...t.catatan], data: [] };
  }
  const top = hasil.slice(0, o.limit);
  const tokoPembeli = (b: AggBarang) => {
    const names = [...(now.get(normKey(b.barang))?.toko ?? [])].slice(0, 3).map((k) => daftarToko(d).get(k)?.nama ?? k);
    return names.join(", ");
  };
  const ring = [
    `${judul}${lingkup} — ${t.pair.nama} vs ${t.pair.sebelumnya.label}.`,
    `Ditemukan ${angka(hasil.length)} produk. Teratas: ${top[0].b.barang} (${o.jenis === "terlaris" ? rp(top[0].s) : `${rp(top[0].s)}, ${selisihTeks(top[0].sel)}, ${tandaPct(top[0].pct)}`}).`,
  ];
  if (o.jenis === "baru") ring.push(`Contoh toko pembeli ${top[0].b.barang}: ${tokoPembeli(top[0].b) || "-"}.`);

  return {
    ok: true, ringkasan: [...ring, ...t.catatan],
    data: top.map((x) => ({ produk: x.b.barang, brand: x.b.brand, kategori: x.b.kategori, penjualanSekarang: x.s, penjualanSebelumnya: x.p, selisih: x.sel, persen: x.pct, qtySekarang: x.sq, qtySebelumnya: x.pq, jumlahTokoPembeli: x.toko, ...(o.jenis === "baru" ? { tokoPembeli: tokoPembeli(x.b) } : {}) })),
    tampilan: {
      tabel: {
        judul: `${judul}${lingkup}`,
        kolom: ["#", "Produk", "Sekarang", "Pembanding", "Selisih", o.jenis === "baru" ? "Toko" : "%"],
        baris: top.map((x, i) => [String(i + 1), cut(x.b.barang), rp(x.s), rp(x.p), selisihTeks(x.sel), o.jenis === "baru" ? String(x.toko) : tandaPct(x.pct)]),
      },
    },
    konteks: { ...(tokoNama ? { toko: tokoNama } : {}), produk: top[0].b.barang, periode: o.periode, topik: `produk_${o.jenis}` },
  };
}

// ---------------------------------------------------------------- 3. profil + penyebab penurunan toko
export function profilToko(d: DataBisnis, namaToko: string, periode: JenisPeriode = "bulan_ini"): HasilAlat {
  const c = cariToko(d, namaToko);
  if ("ambigu" in c) return { ok: false, error: `Nama toko ambigu: ${c.ambigu.join("; ")}`, ringkasan: [] };
  if ("tidakAda" in c) return { ok: false, error: `Toko "${namaToko}" tidak ditemukan.`, ringkasan: [] };
  const toko = c.toko;
  const ring: string[] = [`Toko ${toko.nama} (${toko.area}${toko.kabupaten ? `, ${toko.kabupaten}` : ""}${toko.kelas ? `, kelas ${toko.kelas}` : ""}).`];
  const data: Record<string, unknown> = { toko: toko.nama, area: toko.area, kabupaten: toko.kabupaten };
  const tampilan: Tampilan = {};
  const m0 = parseIso(d.hariIni).m0;

  const dapRow = d.dap?.find((r) => normKey(r.toko) === toko.key);
  if (dapRow) {
    const seri = dapRow.bulanan.slice(0, m0 + 1);
    data.omzetBulananDAP = seri;
    const aktif = seri.filter((x) => x > 0).length;
    ring.push(`Omzet per bulan (DAP): ${seri.map((v, i) => `${NAMA_BULAN[i].slice(0, 3)} ${rp(v)}`).join(", ")}.`);
    if (dapRow.status) ring.push(`Status DAP: ${dapRow.status}${dapRow.bulanPasif ? `, bulan pasif: ${dapRow.bulanPasif}` : ""}. Bulan aktif bertransaksi: ${aktif} dari ${m0 + 1}.`);
    tampilan.grafik = { judul: `Omzet bulanan ${cut(toko.nama, 20)} (DAP)`, jenis: "line", satuan: "rp", label: seri.map((_, i) => NAMA_BULAN[i].slice(0, 3)), seri: [{ nama: "Omzet", nilai: seri.map(Math.round) }] };
    if (dapRow.targetToko > 0) ring.push(`Target toko ${rp(dapRow.targetToko)}; omzet bulan berjalan ${rp(seri[m0] ?? 0)} (${persenTeks(((seri[m0] ?? 0) / dapRow.targetToko) * 100)} dari target).`);
  }

  // Penyebab: kontribusi produk terhadap selisih (periode setara)
  const t = d.produk?.length ? ambilTransaksi(d, periode) : null;
  if (t && !("error" in t) && t.pair.sebelumnya) {
    const mine = (rs: ProdukRow[]) => rs.filter((r) => normKey(r.pelanggan) === toko.key);
    const now = aggBarang(mine(t.sekarang)); const prev = aggBarang(mine(t.sebelumnya));
    const totNow = sum([...now.values()], (x) => x.penjualan); const totPrev = sum([...prev.values()], (x) => x.penjualan);
    const delta = [...new Set([...now.keys(), ...prev.keys()])].map((k) => {
      const a = now.get(k); const b = prev.get(k);
      return { nama: (a ?? b)!.barang, s: a?.penjualan ?? 0, p: b?.penjualan ?? 0, sel: (a?.penjualan ?? 0) - (b?.penjualan ?? 0) };
    });
    const turun = delta.filter((x) => x.sel < 0).sort((a, b) => a.sel - b.sel);
    const naik = delta.filter((x) => x.sel > 0).sort((a, b) => b.sel - a.sel);
    const berhenti = delta.filter((x) => x.p > 0 && x.s === 0).sort((a, b) => b.p - a.p);
    ring.push(`Transaksi PRODUK ${t.pair.nama}: ${rp(totNow)} vs ${rp(totPrev)} pembanding (${selisihTeks(totNow - totPrev)}, ${tandaPct(tumbuh(totNow, totPrev))})${t.setara ? "" : " — belum setara"}.`);
    if (turun.length) ring.push(`Penyebab terbesar penurunan: ${turun.slice(0, 3).map((x) => `${x.nama} (${selisihTeks(x.sel)})`).join(", ")}.`);
    if (berhenti.length) ring.push(`Produk yang dibeli di pembanding tapi tidak di periode ini: ${berhenti.slice(0, 3).map((x) => `${x.nama} (${rp(x.p)})`).join(", ")}.`);
    if (naik.length) ring.push(`Produk yang naik: ${naik.slice(0, 2).map((x) => `${x.nama} (${selisihTeks(x.sel)})`).join(", ")}.`);
    ring.push(...t.catatan);
    data.penyebab = { totalSekarang: totNow, totalSebelumnya: totPrev, produkTurun: turun.slice(0, 5), produkBerhenti: berhenti.slice(0, 5), produkNaik: naik.slice(0, 5) };
    const baris = [...turun.slice(0, 5), ...naik.slice(0, 3)].map((x) => [cut(x.nama), rp(x.s), rp(x.p), selisihTeks(x.sel)]);
    if (baris.length) tampilan.tabel = { judul: `Perubahan produk ${cut(toko.nama, 22)} (${t.pair.nama})`, kolom: ["Produk", "Sekarang", "Pembanding", "Selisih"], baris };
  } else if (t && "error" in t) ring.push(`Rincian produk tidak tersedia: ${t.error}`);
  else if (!d.produk?.length) ring.push("Rincian produk tidak tersedia (tab PRODUK tidak bisa diakses).");

  return { ok: true, ringkasan: ring, data, tampilan: tampilan.tabel || tampilan.grafik ? tampilan : undefined, konteks: { toko: toko.nama, periode, topik: "profil_toko" } };
}

// ---------------------------------------------------------------- 4. rekomendasi produk untuk toko
interface Rek { key: string; barang: string; brand: string; kategori: string; jenis: "FAKTA" | "PELUANG"; skor: number; alasan: string[]; bukti: string[] }

export function rekomendasiProduk(d: DataBisnis, namaToko: string, limit: number): HasilAlat {
  if (!d.produk?.length) return { ok: false, error: "Rekomendasi butuh data tab PRODUK, tapi data tidak tersedia / tidak diizinkan.", ringkasan: [] };
  const c = cariToko(d, namaToko);
  if ("ambigu" in c) return { ok: false, error: `Nama toko ambigu: ${c.ambigu.join("; ")}`, ringkasan: [] };
  if ("tidakAda" in c) return { ok: false, error: `Toko "${namaToko}" tidak ditemukan.`, ringkasan: [] };
  const toko = c.toko;
  const rows = d.produk;
  const { m0, d: hari } = parseIso(d.hariIni);
  const awalBulan = m0 === 0 ? 0 : m0;

  const milik = rows.filter((r) => normKey(r.pelanggan) === toko.key);
  if (milik.length === 0) {
    return { ok: false, error: `Toko ${toko.nama} belum punya riwayat transaksi produk di tahun ini, jadi rekomendasi berbasis data belum bisa dibuat.`, ringkasan: [] };
  }

  // riwayat toko per barang
  interface Riw { barang: string; brand: string; kategori: string; bulan: Map<number, { qty: number; pj: number }>; terakhir: string; kejadian: Map<number, Set<string>> }
  const riw = new Map<string, Riw>();
  for (const r of milik) {
    const k = normKey(r.barang); const b = bulanIdx(r.bulan);
    if (!k || b < 0) continue;
    let x = riw.get(k);
    if (!x) { x = { barang: r.barang, brand: r.brand, kategori: r.kategori, bulan: new Map(), terakhir: "", kejadian: new Map() }; riw.set(k, x); }
    const ev = x.kejadian.get(b) ?? new Set<string>(); ev.add(r.tanggal || `bulan-${b}`); x.kejadian.set(b, ev);
    const mm = x.bulan.get(b) ?? { qty: 0, pj: 0 };
    mm.qty += r.qty; mm.pj += r.penjualan; x.bulan.set(b, mm);
    if (r.tanggal > x.terakhir) x.terakhir = r.tanggal;
  }

  const catatan: string[] = [];
  const awalBulanIni = hari < 10;
  if (awalBulanIni) catatan.push(`Baru tanggal ${hari} — produk "berhenti" bulan ini masih bisa belum sempat order.`);

  const rek = new Map<string, Rek>();
  const tambah = (key: string, base: Omit<Rek, "key" | "alasan" | "bukti" | "skor" | "jenis">, jenis: Rek["jenis"], skor: number, alasan: string, bukti: string) => {
    const x = rek.get(key);
    if (x) { x.skor += skor * 0.5; x.alasan.push(alasan); x.bukti.push(bukti); if (jenis === "FAKTA") x.jenis = "FAKTA"; return; }
    rek.set(key, { key, ...base, jenis, skor, alasan: [alasan], bukti: [bukti] });
  };

  // A) rutin dibeli lalu berhenti, B) menurun tajam
  for (const [k, x] of riw) {
    const hist = [...x.bulan.entries()].filter(([b]) => b < awalBulan).map(([b]) => b);
    const nowM = x.bulan.get(m0); const prevM = x.bulan.get(m0 - 1);
    const base = { barang: x.barang, brand: x.brand, kategori: x.kategori };
    const kali = sum(hist, (b) => x.kejadian.get(b)?.size ?? 0);
    if (kali >= 2 && !nowM) {
      const tot = sum(hist, (b) => x.bulan.get(b)!.qty);
      tambah(k, base, "FAKTA", (awalBulanIni ? 60 : 100) + Math.min(kali, 6) * 8,
        `Rutin dibeli ${kali} kali di ${hist.sort((a, b) => a - b).map((b) => NAMA_BULAN[b]).join(", ")} tetapi belum dibeli bulan ini`,
        `total qty ${angka(tot)}, terakhir beli ${x.terakhir || NAMA_BULAN[Math.max(...hist)]}`);
    } else if (prevM && nowM && prevM.pj > 0 && (nowM.pj - prevM.pj) / prevM.pj <= -0.3 && !awalBulanIni) {
      tambah(k, base, "FAKTA", 70 + Math.min(30, Math.abs((nowM.pj - prevM.pj) / prevM.pj) * 30),
        `Pembelian turun ${persenTeks(Math.abs(((nowM.pj - prevM.pj) / prevM.pj) * 100))} dibanding bulan lalu`,
        `${NAMA_BULAN[m0 - 1].slice(0, 3)} ${rp(prevM.pj)} → ${NAMA_BULAN[m0].slice(0, 3)} ${rp(nowM.pj)}`);
    }
  }

  // statistik global untuk peluang (bulan berjalan & bulan lalu, berbasis label bulan)
  const jendela = rows.filter((r) => { const b = bulanIdx(r.bulan); return b === m0 || b === m0 - 1; });
  const pembeli = new Map<string, { nama: string; brand: string; kategori: string; toko: Set<string>; tokoArea: Set<string>; now: number; prev: number }>();
  for (const r of jendela) {
    if (r.penjualan <= 0 && r.qty <= 0) continue;
    const k = normKey(r.barang); if (!k) continue;
    let p = pembeli.get(k);
    if (!p) { p = { nama: r.barang, brand: r.brand, kategori: r.kategori, toko: new Set(), tokoArea: new Set(), now: 0, prev: 0 }; pembeli.set(k, p); }
    const tk = normKey(r.pelanggan);
    if (tk !== toko.key) { p.toko.add(tk); if (r.area === toko.area) p.tokoArea.add(tk); }
    if (bulanIdx(r.bulan) === m0) p.now += r.penjualan; else p.prev += r.penjualan;
  }
  const mulai = pertamaMuncul(rows);
  const brandToko = new Set(milik.map((r) => r.brand).filter(Boolean));
  const katToko = new Set(milik.map((r) => r.kategori).filter(Boolean));

  // C/E) laris di toko lain & produk baru, yang belum pernah dibeli toko ini
  for (const [k, p] of pembeli) {
    if (riw.has(k) || p.toko.size < 2) continue;
    const g = tumbuh(p.now, p.prev);
    const cocokBrand = brandToko.has(p.brand); const cocokKat = katToko.has(p.kategori);
    if (!cocokBrand && !cocokKat) continue; // wajib relevan dgn pola beli toko
    const baru = mulai.get(k) !== undefined && mulai.get(k)! >= m0 - 1;
    const naikDaun = g !== null && g >= 25;
    if (!baru && !naikDaun && p.toko.size < 4) continue;
    const skor = 45 + p.tokoArea.size * 6 + Math.min(p.toko.size, 15) * 2 + (cocokBrand ? 12 : 0) + (naikDaun ? Math.min(20, (g ?? 0) / 5) : 0) + (baru ? 12 : 0);
    tambah(k, { barang: p.nama, brand: p.brand, kategori: p.kategori }, "PELUANG", skor,
      `${baru ? "Produk baru, " : ""}dibeli ${p.toko.size} toko lain${p.tokoArea.size ? ` (${p.tokoArea.size} di area ${toko.area})` : ""}${naikDaun ? `, naik ${persenTeks(g ?? 0)} vs bulan lalu` : ""}; toko ini belum pernah membelinya. ${cocokBrand ? `Toko ini membeli brand ${p.brand}.` : `Toko ini membeli kategori ${p.kategori}.`}`,
      `omzet ${NAMA_BULAN[m0].slice(0, 3)} ${rp(p.now)}, ${NAMA_BULAN[m0 - 1]?.slice(0, 3) ?? "-"} ${rp(p.prev)}`);
  }

  // D) pelengkap: toko yang membeli barang utama toko ini juga membeli X
  const pj = new Map<string, number>();
  for (const [k, x] of riw) pj.set(k, sum([...x.bulan.values()], (v) => v.pj));
  const jangkar = [...pj.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const beliPerToko = new Map<string, Set<string>>();
  for (const r of rows) {
    const tk = normKey(r.pelanggan); const bk = normKey(r.barang);
    if (!tk || !bk || tk === toko.key) continue;
    let s = beliPerToko.get(tk); if (!s) { s = new Set(); beliPerToko.set(tk, s); }
    s.add(bk);
  }
  for (const jk of jangkar) {
    const grup = [...beliPerToko.values()].filter((s) => s.has(jk));
    if (grup.length < 5) continue;
    const hitung = new Map<string, number>();
    for (const s of grup) for (const bk of s) if (bk !== jk && !riw.has(bk)) hitung.set(bk, (hitung.get(bk) ?? 0) + 1);
    for (const [bk, n] of hitung) {
      const share = n / grup.length;
      if (n < 3 || share < 0.4) continue;
      const info = pembeli.get(bk) ?? [...aggBarang(rows.filter((r) => normKey(r.barang) === bk)).values()].map((a) => ({ nama: a.barang, brand: a.brand, kategori: a.kategori }))[0];
      if (!info) continue;
      tambah(bk, { barang: info.nama, brand: info.brand, kategori: info.kategori }, "PELUANG", 40 + share * 40,
        `Pelengkap ${riw.get(jk)!.barang}: ${n} dari ${grup.length} toko yang membeli ${riw.get(jk)!.barang} juga membeli produk ini (${persenTeks(share * 100)})`,
        "pola pembelian toko lain (korelasi, belum terbukti untuk toko ini)");
    }
  }

  let urut = [...rek.values()].sort((a, b) => b.skor - a.skor);
  let pilih = urut.slice(0, limit);
  if (limit >= 4 && !pilih.some((x) => x.jenis === "PELUANG")) {
    const p = urut.find((x) => x.jenis === "PELUANG");
    if (p) pilih = [...pilih.slice(0, limit - 1), p];
  }
  if (pilih.length === 0) {
    return { ok: true, ringkasan: [`Belum ada rekomendasi yang kuat untuk ${toko.nama} berdasarkan data yang ada.`, ...catatan], data: [] };
  }

  const diag = profilToko(d, toko.nama, "bulan_ini");
  const ring = [
    `Rekomendasi untuk ${toko.nama}: ${pilih.length} produk (FAKTA = dari riwayat toko itu sendiri; PELUANG = pola toko lain, belum terbukti).`,
    ...pilih.map((x, i) => `${i + 1}. ${x.barang} [${x.jenis}] — ${x.alasan.join("; ")} (${x.bukti.join("; ")}).`),
    ...(diag.ok ? diag.ringkasan.filter((l) => l.startsWith("Transaksi PRODUK") || l.startsWith("Penyebab")) : []),
    ...catatan,
  ];
  return {
    ok: true, ringkasan: ring,
    data: pilih.map((x) => ({ produk: x.barang, brand: x.brand, kategori: x.kategori, jenis: x.jenis, alasan: x.alasan, bukti: x.bukti })),
    tampilan: {
      tabel: {
        judul: `Rekomendasi produk — ${cut(toko.nama, 26)}`,
        kolom: ["#", "Produk", "Jenis", "Alasan & bukti"],
        baris: pilih.map((x, i) => [String(i + 1), cut(x.barang, 30), x.jenis, `${x.alasan[0]} — ${x.bukti[0]}`]),
      },
    },
    konteks: { toko: toko.nama, produk: pilih[0].barang, topik: "rekomendasi" },
  };
}

// ---------------------------------------------------------------- 5. toko potensial untuk produk
export function tokoPotensialProduk(d: DataBisnis, namaProduk: string, limit: number): HasilAlat {
  if (!d.produk?.length) return { ok: false, error: "Butuh data tab PRODUK.", ringkasan: [] };
  const cp = cariProduk(d, namaProduk);
  if ("ambigu" in cp) return { ok: false, error: `Nama produk ambigu: ${cp.ambigu.join("; ")}`, ringkasan: [] };
  if ("tidakAda" in cp) return { ok: false, error: `Produk "${namaProduk}" tidak ditemukan.`, ringkasan: [] };
  const pk = normKey(cp.barang);
  const rows = d.produk;
  const contoh = rows.find((r) => normKey(r.barang) === pk)!;
  const sudah = new Set(rows.filter((r) => normKey(r.barang) === pk).map((r) => normKey(r.pelanggan)));
  const { m0 } = parseIso(d.hariIni);
  const info = daftarToko(d);

  const skor = new Map<string, { nama: string; area: string; brandPj: number; brandN: number; katPj: number; aktif: boolean }>();
  for (const r of rows) {
    const tk = normKey(r.pelanggan);
    if (!tk || sudah.has(tk)) continue;
    const sama = r.brand === contoh.brand; const katSama = r.kategori === contoh.kategori;
    let x = skor.get(tk);
    if (!x) { x = { nama: info.get(tk)?.nama ?? r.pelanggan, area: info.get(tk)?.area ?? r.area, brandPj: 0, brandN: 0, katPj: 0, aktif: false }; skor.set(tk, x); }
    if (sama) { x.brandPj += r.penjualan; x.brandN += 1; }
    if (katSama) x.katPj += r.penjualan;
    if (bulanIdx(r.bulan) >= m0 - 1) x.aktif = true;
  }
  const kand = [...skor.values()].filter((x) => (x.brandN > 0 || x.katPj > 0) && x.aktif)
    .map((x) => ({ ...x, s: (x.brandPj > 0 ? 100 + Math.log10(x.brandPj + 1) * 10 : 0) + Math.log10(x.katPj + 1) * 5 }))
    .sort((a, b) => b.s - a.s).slice(0, limit);
  if (kand.length === 0) return { ok: true, ringkasan: [`Belum ada toko yang cocok untuk ${cp.barang} berdasarkan pola beli brand/kategori yang sama.`], data: [] };

  return {
    ok: true,
    ringkasan: [
      `${angka(sudah.size)} toko sudah pernah membeli ${cp.barang}. Toko berikut BELUM, tapi aktif dan membeli ${contoh.brand ? `brand ${contoh.brand}` : "produk sekelas"} / kategori ${contoh.kategori} (ini PELUANG, belum terbukti).`,
      `Paling potensial: ${kand.slice(0, 3).map((x) => x.nama).join(", ")}.`,
    ],
    data: kand.map((x) => ({ toko: x.nama, area: x.area, penjualanBrandSama: x.brandPj, transaksiBrandSama: x.brandN, penjualanKategoriSama: x.katPj })),
    tampilan: {
      tabel: {
        judul: `Toko potensial: ${cut(cp.barang, 26)}`, kolom: ["#", "Toko", "Area", "Alasan"],
        baris: kand.map((x, i) => [String(i + 1), cut(x.nama), x.area, x.brandPj > 0 ? `beli brand ${contoh.brand} ${rp(x.brandPj)}` : `beli kategori ${contoh.kategori} ${rp(x.katPj)}`]),
      },
    },
    konteks: { produk: cp.barang, topik: "toko_potensial", daftarToko: kand.map((x) => x.nama) },
  };
}

// ---------------------------------------------------------------- 6. tren bulanan
export function trenBulanan(d: DataBisnis, o: { toko?: string; produk?: string }): HasilAlat {
  const { m0 } = parseIso(d.hariIni);
  const label = NAMA_BULAN.slice(0, m0 + 1).map((n) => n.slice(0, 3));

  if (o.produk) {
    if (!d.produk?.length) return { ok: false, error: "Butuh data tab PRODUK.", ringkasan: [] };
    const cp = cariProduk(d, o.produk);
    if ("ambigu" in cp) return { ok: false, error: `Nama produk ambigu: ${cp.ambigu.join("; ")}`, ringkasan: [] };
    if ("tidakAda" in cp) return { ok: false, error: `Produk "${o.produk}" tidak ditemukan.`, ringkasan: [] };
    let tokoKey = ""; let tokoNama = "";
    if (o.toko) {
      const c = cariToko(d, o.toko);
      if (!("toko" in c)) return { ok: false, error: `Toko "${o.toko}" tidak ditemukan/ambigu.`, ringkasan: [] };
      tokoKey = c.toko.key; tokoNama = c.toko.nama;
    }
    const pj = Array(m0 + 1).fill(0); const qty = Array(m0 + 1).fill(0);
    for (const r of d.produk) {
      if (normKey(r.barang) !== normKey(cp.barang) || (tokoKey && normKey(r.pelanggan) !== tokoKey)) continue;
      const b = bulanIdx(r.bulan); if (b < 0 || b > m0) continue;
      pj[b] += r.penjualan; qty[b] += r.qty;
    }
    return {
      ok: true,
      ringkasan: [`Tren ${cp.barang}${tokoNama ? ` di ${tokoNama}` : ""}: ${label.map((l, i) => `${l} ${rp(pj[i])} (qty ${angka(qty[i])})`).join(", ")}. Bulan terakhir (${label[m0]}) masih berjalan.`],
      data: { produk: cp.barang, toko: tokoNama || undefined, penjualan: pj, qty },
      tampilan: {
        tabel: { judul: `Tren ${cut(cp.barang, 24)}${tokoNama ? " — " + cut(tokoNama, 18) : ""}`, kolom: ["Bulan", "Penjualan", "Qty"], baris: label.map((l, i) => [l, rp(pj[i]), angka(qty[i])]) },
        grafik: { judul: `Penjualan ${cut(cp.barang, 24)}`, jenis: "line", satuan: "rp", label, seri: [{ nama: "Penjualan", nilai: pj.map(Math.round) }] },
      },
      konteks: { produk: cp.barang, ...(tokoNama ? { toko: tokoNama } : {}), topik: "tren_produk" },
    };
  }

  if (!d.dap?.length) return { ok: false, error: "Tren omzet bulanan butuh data tab DAP (tidak tersedia / tidak diizinkan).", ringkasan: [] };
  let rows = d.dap; let nama = "seluruh toko";
  if (o.toko) {
    const c = cariToko(d, o.toko);
    if (!("toko" in c)) return { ok: false, error: `Toko "${o.toko}" tidak ditemukan/ambigu.`, ringkasan: [] };
    rows = d.dap.filter((r) => normKey(r.toko) === c.toko.key); nama = c.toko.nama;
    if (!rows.length) return { ok: false, error: `Toko ${nama} tidak ada di DAP.`, ringkasan: [] };
  }
  const seri = label.map((_, i) => sum(rows, (r) => r.bulanan[i] ?? 0));
  const ring = [`Tren omzet ${nama} (DAP): ${label.map((l, i) => `${l} ${rp(seri[i])}`).join(", ")}. ${label[m0]} masih berjalan.`];
  if (m0 >= 2 && seri[m0 - 1] > 0 && seri[m0 - 2] > 0) {
    ring.push(`Bulan penuh terakhir ${label[m0 - 1]} vs ${label[m0 - 2]}: ${selisihTeks(seri[m0 - 1] - seri[m0 - 2])} (${tandaPct(tumbuh(seri[m0 - 1], seri[m0 - 2]))}).`);
  }
  return {
    ok: true, ringkasan: ring, data: { toko: nama, omzet: seri },
    tampilan: {
      tabel: { judul: `Omzet bulanan — ${cut(nama, 24)}`, kolom: ["Bulan", "Omzet", "MoM"], baris: label.map((l, i) => [l, rp(seri[i]), i === 0 ? "-" : tandaPct(tumbuh(seri[i], seri[i - 1]))]) },
      grafik: { judul: `Omzet bulanan ${cut(nama, 24)}`, jenis: "line", satuan: "rp", label, seri: [{ nama: "Omzet", nilai: seri.map(Math.round) }] },
    },
    konteks: { ...(o.toko ? { toko: nama } : {}), topik: "tren_omzet" },
  };
}
