// node --import ./scripts/ts-resolve.mjs --experimental-strip-types scripts/test-analis.mts
import assert from "node:assert/strict";
import http from "node:http";
import { jalankanAnalis } from "../src/lib/bisnis/analis.ts";
import { perluAnalis } from "../src/lib/bisnis/intent.ts";
import type { DataBisnis, Konteks } from "../src/lib/bisnis/engine.ts";

const hariIni = "2026-11-18";
const P = (bulan: string, tanggal: string, pel: string, barang: string, brand: string, qty: number, pj: number) =>
  ({ bulan, area: "SOLO", kabupaten: "Sleman", kecamatan: "X", kategori: "Makanan", brand, barang, pelanggan: pel, tanggal, qty, penjualan: pj });
const O = "Oktober 2026", N = "November 2026";
const data: DataBisnis = { hariIni, dap: undefined, produk: [
  P(O, "2026-10-05", "Toko A", "Whiskas 1kg", "Whiskas", 10, 1000), P(O, "2026-10-06", "Toko A", "Pro Plan 3kg", "ProPlan", 2, 600),
  P(O, "2026-10-12", "Toko A", "Pro Plan 3kg", "ProPlan", 2, 600), P(N, "2026-11-03", "Toko A", "Whiskas 1kg", "Whiskas", 5, 500),
  P(O, "2026-10-07", "Toko B", "Whiskas 1kg", "Whiskas", 5, 500), P(N, "2026-11-04", "Toko B", "Whiskas 1kg", "Whiskas", 20, 2000),
  P(N, "2026-11-07", "Toko D", "Whiskas Pouch", "Whiskas", 12, 240), P(N, "2026-11-08", "Toko C", "Whiskas Pouch", "Whiskas", 8, 160),
  P(N, "2026-11-09", "Toko B", "Whiskas Pouch", "Whiskas", 8, 160), P(O, "2026-10-09", "Toko C", "Whiskas 1kg", "Whiskas", 3, 300),
] };

// ---- model palsu: skenario ditentukan per pesan terakhir
let panggilan: any[] = [];
const server = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const j = JSON.parse(b); panggilan.push(j);
    const last = j.messages[j.messages.length - 1];
    const user = [...j.messages].reverse().find((m: any) => m.role === "user")?.content as string;
    const kirim = (message: any) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ choices: [{ message }] })); };
    const tool = (name: string, args: object) => kirim({ role: "assistant", content: null, tool_calls: [{ id: "c1", function: { name, arguments: JSON.stringify(args) } }] });
    if (last.role === "tool") {
      const out = JSON.parse(last.content);
      if (user.startsWith("HALUSINASI")) return kirim({ role: "assistant", content: "Omzet naik Rp9.999.999 Bos." });
      return kirim({ role: "assistant", content: `Ringkasan Bos: ${out.ringkasan?.[0] ?? out.error}` });
    }
    if (user.includes("omzet")) return tool("omzet_ringkasan", { periode: "bulan_ini" });
    if (user.includes("paling turun")) return tool("ranking_toko", { metrik: "penurunan", periode: "bulan_ini", limit: 3 });
    if (user.includes("penyebab")) return tool("profil_toko", {});            // tanpa argumen → harus pakai konteks
    if (user.includes("tawarkan")) return tool("rekomendasi_produk", { limit: 3 });
    if (user.startsWith("HALUSINASI")) return tool("omzet_ringkasan", { periode: "bulan_ini" });
    if (user.includes("hack")) return tool("jalankan_kode", { code: "rm -rf /" });
    return kirim({ role: "assistant", content: "Saya fokus pada analisis penjualan, Bos." });
  });
});
await new Promise<void>((r) => server.listen(0, r));
process.env.OPENAI_API_KEY = "test"; process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as any).port}`;

let konteks: Konteks = {}; const riwayat: any[] = [];
const tanya = async (text: string) => {
  const h = await jalankanAnalis({ text, riwayat, konteks, data });
  konteks = h.konteks; riwayat.push({ role: "user", content: text }, { role: "assistant", content: h.reply });
  return h;
};

// 1) alur percakapan lanjutan menyimpan konteks toko
let h = await tanya("Berapa omzet bulan ini?");
assert.equal(h.source, "analis-ai"); assert.match(h.reply, /Omzet bulan ini/); assert.ok(h.tampilan.length >= 1);
h = await tanya("Toko mana yang paling turun?");
assert.equal(konteks.toko, "Toko A");
h = await tanya("Produk apa penyebabnya?");
assert.match(h.reply, /Toko A/, "alat profil_toko harus memakai konteks Toko A");
h = await tanya("Apa yang harus saya tawarkan ke toko tersebut?");
assert.match(h.reply, /Rekomendasi untuk Toko A/);

// 2) halusinasi angka → diganti ringkasan backend
h = await tanya("HALUSINASI omzet");
assert.equal(h.source, "analis-rule"); assert.ok(!h.reply.includes("9.999.999")); assert.match(h.reply, /Omzet bulan ini/);

// 3) alat tak dikenal (mis. eksekusi kode) ditolak, tidak jalan
h = await tanya("hack sistem");
assert.ok(!/rm -rf/.test(h.reply));

// 4) tanpa API key → mode aturan tetap menjawab
delete process.env.OPENAI_API_KEY;
h = await jalankanAnalis({ text: "rekomendasi produk untuk Toko A", riwayat: [], konteks: {}, data });
assert.equal(h.source, "analis-rule");
assert.equal(h.reply.startsWith("Maaf"), true); // tidak ada nama toko di teks & konteks kosong → minta toko
h = await jalankanAnalis({ text: "rekomendasi produk", riwayat: [], konteks: { toko: "Toko A" }, data });
assert.match(h.reply, /Pro Plan 3kg \[FAKTA\]/);

// 5) data tidak punya DAP (tanpa akses) → alat DAP-only gagal sopan
h = await jalankanAnalis({ text: "tren omzet", riwayat: [], konteks: {}, data });
assert.match(h.reply, /DAP|tidak/);

// 6) routing intent
assert.equal(perluAnalis("Berapa omzet bulan ini?", false), true);
assert.equal(perluAnalis("Buka penjualan yang turun bulan ini", false), false);
assert.equal(perluAnalis("Toko omset tertinggi kabupaten Sleman", false), false);
assert.equal(perluAnalis("Berapa pencapaian bulan ini?", false), false);
assert.equal(perluAnalis("Toko mana yang paling turun?", true), true);
assert.equal(perluAnalis("Toko mana yang paling turun?", false), false);
assert.equal(perluAnalis("Rekomendasikan 5 produk untuk Toko A", false), true);
assert.equal(perluAnalis("Apa yang harus saya tawarkan ke toko tersebut?", true), true);
assert.equal(perluAnalis("Liat tokonya yang jeblok bulan ini", false), false);
server.close(); console.log("UJI ANALIS LULUS");
