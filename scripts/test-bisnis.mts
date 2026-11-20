// Uji mesin analisis: node --experimental-strip-types scripts/test-bisnis.mts
import assert from "node:assert/strict";
import * as E from "../src/lib/bisnis/engine.ts";

// Hari ini: Rabu 18 Nov 2026 (WIB). Senin minggu ini = 16 Nov. Minggu lalu: 9–11 Nov (Senin–Rabu).
const hariIni = "2026-11-18";
const P = (bulan: string, tanggal: string, pel: string, barang: string, brand: string, qty: number, pj: number, area = "SOLO", kat = brand === "Me-O" ? "Aksesoris" : "Makanan") =>
  ({ bulan, area, kabupaten: "Sleman", kecamatan: "X", kategori: kat, brand, barang, pelanggan: pel, tanggal, qty, penjualan: pj });
const OKT = "Oktober 2026", NOV = "November 2026";
const produk = [
  // Toko A: Oktober rutin beli Whiskas & Pro Plan; November hanya Whiskas turun
  P(OKT, "2026-10-05", "Toko A", "Whiskas 1kg", "Whiskas", 10, 1000),
  P(OKT, "2026-10-06", "Toko A", "Pro Plan 3kg", "ProPlan", 2, 600),
  P(OKT, "2026-10-12", "Toko A", "Pro Plan 3kg", "ProPlan", 2, 600),
  P(OKT, "2026-10-14", "Toko A", "Whiskas 1kg", "Whiskas", 10, 1000),
  P(NOV, "2026-11-03", "Toko A", "Whiskas 1kg", "Whiskas", 5, 500),
  // Toko B: naik
  P(OKT, "2026-10-07", "Toko B", "Whiskas 1kg", "Whiskas", 5, 500),
  P(NOV, "2026-11-04", "Toko B", "Whiskas 1kg", "Whiskas", 20, 2000),
  P(NOV, "2026-11-10", "Toko B", "Me-O Baru 500g", "Me-O", 10, 400),
  // Toko C, D membeli produk baru Me-O Baru (peluang untuk A? A tidak beli brand Me-O → tidak relevan)
  P(NOV, "2026-11-05", "Toko C", "Me-O Baru 500g", "Me-O", 4, 160),
  P(NOV, "2026-11-06", "Toko C", "Whiskas 1kg", "Whiskas", 3, 300),
  P(OKT, "2026-10-09", "Toko C", "Whiskas 1kg", "Whiskas", 3, 300),
  // Toko D beli Whiskas Pouch (brand Whiskas -> relevan untuk A) bersama C -> naik daun, baru
  P(NOV, "2026-11-07", "Toko D", "Whiskas Pouch", "Whiskas", 12, 240),
  P(NOV, "2026-11-08", "Toko C", "Whiskas Pouch", "Whiskas", 8, 160),
  P(NOV, "2026-11-09", "Toko B", "Whiskas Pouch", "Whiskas", 8, 160),
  // Minggu: minggu ini (16–18 Nov) vs minggu lalu (9–11 Nov)
  P(NOV, "2026-11-16", "Toko B", "Whiskas 1kg", "Whiskas", 10, 1000),
  P(NOV, "2026-11-17", "Toko A", "Whiskas 1kg", "Whiskas", 1, 100),
  P(NOV, "2026-11-11", "Toko A", "Whiskas 1kg", "Whiskas", 4, 400),
];
const dap = [
  { area: "SOLO", kabupaten: "Sleman", kecamatan: "X", toko: "Toko A", pelanggan: 0, adm: "", kelasToko: "A", kelasByr: "", bulanan: [0,0,0,0,0,0,0,0,0,3200,1100,0], omsetYtd: 4300, targetToko: 3000, status: "AKTIF", bulanPasif: "" },
  { area: "SOLO", kabupaten: "Sleman", kecamatan: "X", toko: "Toko B", pelanggan: 0, adm: "", kelasToko: "A", kelasByr: "", bulanan: [0,0,0,0,0,0,0,0,0,500,4000,0], omsetYtd: 4500, targetToko: 3000, status: "AKTIF", bulanPasif: "" },
];
const d = { dap, produk, hariIni } as E.DataBisnis;

// --- periode setara
const pm = E.periodeUntuk("bulan_ini", hariIni);
assert.equal(pm.sekarang.awal, "2026-11-01"); assert.equal(pm.sekarang.akhir, "2026-11-18");
assert.equal(pm.sebelumnya!.awal, "2026-10-01"); assert.equal(pm.sebelumnya!.akhir, "2026-10-18");
const pw = E.periodeUntuk("minggu_ini", hariIni);
assert.equal(pw.sekarang.awal, "2026-11-16"); assert.equal(pw.sebelumnya!.awal, "2026-11-09"); assert.equal(pw.sebelumnya!.akhir, "2026-11-11");
assert.equal(E.hariIniWIB(new Date("2026-11-17T20:00:00Z")), "2026-11-18"); // UTC+7 melewati tengah malam

// --- omzet MTD setara dari PRODUK: Nov 1–18 vs Okt 1–18
// Nov: A 500+100+400=1000; B 2000+400+160+1000=3560; C 160+300+160=620; D 240 => 5420
// Okt 1–18: A 3200; B 500; C 300 => 4000
let r = E.omzetRingkasan(d, "bulan_ini");
assert.ok(r.ok); const dd = r.data as any;
assert.equal(dd.sekarang, 5420); assert.equal(dd.sebelumnya, 4000); assert.equal(dd.selisih, 1420);
assert.ok(Math.abs(dd.persen - 35.5) < 1e-9);
assert.equal(dd.setara, true);

// --- minggu: ini = B1000 + A100 = 1100 ; lalu (9–11 Nov) = B160 (9 Nov) + A400 (11 Nov) = 560
r = E.omzetRingkasan(d, "minggu_ini");
assert.equal((r.data as any).sekarang, 1100); assert.equal((r.data as any).sebelumnya, 960); // B 160+400 (9,10 Nov) + A 400 (11 Nov)

// --- ranking penurunan: A turun (1000 vs 3200 = -2200)
let rk = E.rankingToko(d, { metrik: "penurunan", jenis: "bulan_ini", limit: 5 });
assert.equal((rk.data as any[])[0].toko, "Toko A"); assert.equal((rk.data as any[])[0].selisih, -2200);
assert.equal(rk.konteks!.toko, "Toko A");
// bulan_lalu memakai DAP bulan penuh: Okt 3200+500 vs Sep 0 → A naik dari 0 (tidak dianggap turun)
rk = E.rankingToko(d, { metrik: "omzet", jenis: "bulan_lalu", limit: 5 });
assert.equal((rk.data as any[])[0].toko, "Toko A"); assert.equal((rk.data as any[])[0].sekarang, 3200);

// --- penyebab: Pro Plan berhenti, Whiskas turun
const pf = E.profilToko(d, "toko a");
assert.ok(pf.ok); const pyb = (pf.data as any).penyebab;
assert.equal(pyb.produkBerhenti[0].nama, "Pro Plan 3kg");
assert.equal(pyb.produkTurun[0].nama, "Pro Plan 3kg"); assert.equal(pyb.produkTurun[0].sel, -1200); assert.equal(pyb.produkTurun[1].sel, -1000);

// --- rekomendasi Toko A
const rec = E.rekomendasiProduk(d, "Toko A", 5);
assert.ok(rec.ok); const rows = rec.data as any[];
const pro = rows.find((x) => x.produk === "Pro Plan 3kg");
assert.ok(pro && pro.jenis === "FAKTA", "Pro Plan harus FAKTA (rutin lalu berhenti)");
const pouch = rows.find((x) => x.produk === "Whiskas Pouch");
assert.ok(pouch && pouch.jenis === "PELUANG", "Whiskas Pouch peluang (3 toko lain, brand sama)");
assert.ok(!rows.some((x) => x.produk === "Me-O Baru 500g"), "Me-O tidak relevan dg pola A");

// --- toko potensial untuk produk baru
const tp = E.tokoPotensialProduk(d, "Me-O Baru", 5);
assert.ok(tp.ok);
// --- nama ambigu / tak ada
assert.equal(E.rekomendasiProduk(d, "Toko Z", 3).ok, false);
// --- analisis produk baru
const nb = E.analisisProduk(d, { jenis: "baru", periode: "bulan_ini", limit: 5 });
assert.ok((nb.data as any[]).some((x) => x.produk === "Whiskas Pouch"));
// --- tren
assert.ok(E.trenBulanan(d, { toko: "Toko A" }).ok);

// --- tanggal tidak lengkap → fallback tidak setara, minggu ditolak
const tanpaTgl = { ...d, produk: produk.map((x) => ({ ...x, tanggal: "" })) } as E.DataBisnis;
const fb = E.omzetRingkasan(tanpaTgl, "bulan_ini");
assert.equal((fb.data as any).setara, false);
assert.equal(E.omzetRingkasan(tanpaTgl, "minggu_ini").ok, false);
console.log("SEMUA UJI LULUS");
