/**
 * Orkestrator AI Business Analyst & Sales Advisor.
 * Alur: pesan → model memilih alat (whitelist) → backend menghitung → model merangkai
 * jawaban → pengaman angka → hasil + tabel/grafik. Tanpa API key/gagal → mode aturan.
 */
import { ALAT_OPENAI, jalankanAlat } from "./tools";
import type { DataBisnis, HasilAlat, Konteks, Tampilan } from "./engine";

export interface PesanRiwayat { role: "user" | "assistant"; content: string }
export interface HasilAnalis {
  reply: string;
  tampilan: Tampilan[];
  konteks: Konteks;
  source: "analis-ai" | "analis-rule";
}

const MAKS_RONDE = 5;

export function systemPrompt(hariIni: string, konteks: Konteks, sumber: { dap: boolean; produk: boolean }): string {
  return `Kamu F.R.I.D.A.Y, analis bisnis dan penasihat penjualan distributor. Panggil pengguna "Bos". Bahasa Indonesia natural, santai tapi sopan.
Hari ini ${hariIni} (WIB). Sumber data tersedia: DAP (omzet per toko per BULAN)=${sumber.dap ? "ya" : "tidak"}, PRODUK (transaksi per tanggal/toko/barang)=${sumber.produk ? "ya" : "tidak"}.

ATURAN KETAT:
1. Semua angka (omzet, selisih, persen, qty, jumlah toko) HANYA dari hasil alat. Dilarang menghitung, membulatkan ulang, memperkirakan, atau mengarang angka. Salin angka persis seperti di hasil alat (mis. "Rp1.250.000", "+12,5%").
2. Untuk pertanyaan data, SELALU panggil alat dulu. Jangan menjawab angka dari ingatan atau dari percakapan sebelumnya; panggil ulang alat.
3. Sebut nama toko dan produk spesifik, periode yang dibandingkan, dan sumber data. Jika hasil alat bilang perbandingan "belum setara" atau ada catatan, sampaikan.
4. Pisahkan jelas: FAKTA (tercatat di data) vs PELUANG/PREDIKSI (pola toko lain, belum terbukti). Jangan pernah menyebut peluang sebagai kepastian.
5. Rekomendasi produk harus dari alat rekomendasi_produk / toko_potensial_produk; sebut nama produk, nama toko, alasan, dan bukti dari hasil alat. Jangan menambah produk di luar hasil alat.
6. Jika alat mengembalikan error atau data kosong, katakan apa adanya dan apa yang kurang. Jangan menebak. Jika nama toko/produk ambigu, tanyakan mana yang dimaksud dengan menyebut pilihan dari error.
7. Pertanyaan lanjutan ("toko itu", "produk penyebabnya", "yang tadi"): pakai konteks di bawah; kosongkan argumen toko/produk agar sistem memakai konteks.
8. Tabel dan grafik ditampilkan otomatis oleh sistem — jangan buat tabel/markdown. Jawab ringkas: 3-7 kalimat; untuk rekomendasi boleh daftar bernomor singkat (satu baris per produk). Tanpa emoji dan tanpa markdown (tidak ada ** atau #).
9. Mode ini hanya analisis dan rekomendasi (read-only). Kamu tidak bisa mengubah data atau menjalankan kode.
10. Di luar bisnis/data distributor: balas singkat bahwa kamu fokus pada analisis penjualan.

Konteks percakapan saat ini: ${JSON.stringify(konteks)}`;
}

// ------------------------------------------------------------ pengaman angka
const digitTokens = (s: string): Set<string> => {
  const out = new Set<string>();
  for (const m of s.matchAll(/\d[\d.,]*/g)) {
    const n = m[0].replace(/[.,]/g, "");
    if (n) out.add(n);
  }
  return out;
};

/** Angka (≥3 digit, bukan tahun) di jawaban yang tidak ditemukan di hasil alat. */
export function angkaTakTerverifikasi(reply: string, hasil: HasilAlat[], konteks: Konteks): string[] {
  const sah = new Set<string>();
  for (const h of hasil) for (const t of digitTokens(JSON.stringify([h.ringkasan, h.data]))) sah.add(t);
  for (const t of digitTokens(JSON.stringify(konteks))) sah.add(t);
  const salah: string[] = [];
  for (const t of digitTokens(reply)) {
    if (t.length < 3) continue;
    if (/^20[2-3]\d$/.test(t)) continue;
    if (!sah.has(t)) salah.push(t);
  }
  return salah;
}

// ------------------------------------------------------------ pemanggilan model
interface ToolCall { id: string; function: { name: string; arguments: string } }
interface ChatMsg { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }

async function chat(messages: ChatMsg[], pakaiAlat: boolean): Promise<ChatMsg | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const base = (process.env.OPENAI_BASE_URL || "https://freebuff.com/api/v1/paid").replace(/\/+$/, "");
  const model = process.env.OPENAI_ANALIS_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.2, messages,
      ...(pakaiAlat ? { tools: ALAT_OPENAI, tool_choice: "auto" } : {}),
    }),
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: ChatMsg }[] };
  return json.choices?.[0]?.message ?? null;
}

/** Hasil alat untuk model: ringkas, tanpa tampilan (tabel/grafik dikirim langsung ke klien). */
const untukModel = (h: HasilAlat) =>
  JSON.stringify(h.ok ? { ok: true, ringkasan: h.ringkasan, data: h.data } : { ok: false, error: h.error }).slice(0, 9000);

function gabungKonteks(k: Konteks, h: HasilAlat): Konteks {
  return h.ok && h.konteks ? { ...k, ...h.konteks } : k;
}

export async function jalankanAnalis(o: {
  text: string; riwayat: PesanRiwayat[]; konteks: Konteks; data: DataBisnis;
}): Promise<HasilAnalis> {
  let konteks = o.konteks;
  const tampilan: Tampilan[] = [];
  const hasil: HasilAlat[] = [];
  const sumber = { dap: !!o.data.dap, produk: !!o.data.produk };

  const jalankan = (nama: string, argsRaw: string) => {
    let args: unknown = {};
    try { args = JSON.parse(argsRaw || "{}"); } catch { /* argumen rusak → default/konteks */ }
    const h = jalankanAlat(nama, args, o.data, konteks);
    hasil.push(h);
    if (h.ok && h.tampilan) tampilan.push(h.tampilan);
    konteks = gabungKonteks(konteks, h);
    return h;
  };

  try {
    const messages: ChatMsg[] = [
      { role: "system", content: systemPrompt(o.data.hariIni, konteks, sumber) },
      ...o.riwayat.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: o.text },
    ];
    for (let ronde = 0; ronde < MAKS_RONDE; ronde++) {
      const msg = await chat(messages, ronde < MAKS_RONDE - 1);
      if (!msg) break;
      if (msg.tool_calls?.length) {
        messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls.slice(0, 4)) {
          const h = jalankan(tc.function.name, tc.function.arguments);
          messages.push({ role: "tool", tool_call_id: tc.id, content: untukModel(h) });
        }
        continue;
      }
      const reply = (msg.content ?? "").replace(/\*\*|^#+\s*/gm, "").trim();
      if (!reply) break;
      const salah = hasil.length ? angkaTakTerverifikasi(reply, hasil, konteks) : [];
      if (hasil.length === 0) {
        // model menjawab tanpa memanggil alat: izinkan hanya jawaban tanpa angka (sapaan/penolakan)
        if (/\d{3,}/.test(reply)) break;
      } else if (salah.length) {
        break; // angka tak terverifikasi → pakai ringkasan backend
      }
      return { reply, tampilan: tampilan.slice(-2), konteks, source: "analis-ai" };
    }
  } catch {
    /* jatuh ke mode aturan */
  }

  return modeAturan(o.text, o.data, konteks, hasil, tampilan);
}

// ------------------------------------------------------------ mode aturan (tanpa model / gagal)
const has = (t: string, re: RegExp) => re.test(t);

function modeAturan(text: string, data: DataBisnis, konteks: Konteks, sudah: HasilAlat[], tampilanAda: Tampilan[]): HasilAnalis {
  // Jika alat sudah dijalankan model tetapi jawabannya ditolak pengaman, pakai ringkasan backend.
  if (sudah.some((h) => h.ok)) {
    const ok = sudah.filter((h) => h.ok);
    return {
      reply: ok.flatMap((h) => h.ringkasan).slice(0, 8).join("\n"),
      tampilan: tampilanAda.slice(-2), konteks, source: "analis-rule",
    };
  }
  if (sudah.length) {
    return { reply: `Maaf Bos, ${sudah[sudah.length - 1].error}`, tampilan: [], konteks, source: "analis-rule" };
  }

  const t = text.toLowerCase();
  const periode = has(t, /minggu/) ? "minggu_ini" : has(t, /bulan lalu/) ? "bulan_lalu" : "bulan_ini";
  const nama = (nm: string, args: Record<string, unknown>) => jalankanAlat(nm, args, data, konteks);
  let h: HasilAlat | null = null;

  if (has(t, /rekomendasi|tawar|strategi|saran/)) h = nama("rekomendasi_produk", { limit: has(t, /\b(\d{1,2})\b/) ? Number(t.match(/\b(\d{1,2})\b/)![1]) : 5 });
  else if (has(t, /penyebab|kenapa|mengapa|knp/)) h = nama("profil_toko", { periode });
  else if (has(t, /produk/) && has(t, /baru/)) h = nama("analisis_produk", { jenis: "baru", periode });
  else if (has(t, /produk/) && has(t, /berhenti|jarang/)) h = nama("analisis_produk", { jenis: "berhenti", periode });
  else if (has(t, /produk/) && has(t, /naik daun|tren|trend/)) h = nama("analisis_produk", { jenis: "naik_daun", periode });
  else if (has(t, /produk/) && has(t, /turun|menurun/)) h = nama("analisis_produk", { jenis: "turun", periode });
  else if (has(t, /produk/) && has(t, /naik|meningkat/)) h = nama("analisis_produk", { jenis: "naik", periode });
  else if (has(t, /produk/) && has(t, /lambat/)) h = nama("analisis_produk", { jenis: "terlambat", periode });
  else if (has(t, /produk/) && has(t, /laris/)) h = nama("analisis_produk", { jenis: "terlaris", periode });
  else if (has(t, /toko/) && has(t, /turun|anjlok|menurun|jeblok/)) h = nama("ranking_toko", { metrik: "penurunan", periode, limit: 5 });
  else if (has(t, /toko/) && has(t, /naik|tumbuh|meningkat/)) h = nama("ranking_toko", { metrik: "pertumbuhan", periode, limit: 5 });
  else if (has(t, /ranking|peringkat|tertinggi|top/)) h = nama("ranking_toko", { metrik: "omzet", periode, limit: 5 });
  else if (has(t, /tren|trend/)) h = nama("tren_bulanan", {});
  else if (has(t, /omz?et|omset|penjualan/)) h = nama("omzet_ringkasan", { periode });

  if (!h) {
    return {
      reply: "Saya belum paham maksudnya, Bos. Coba tanya misalnya: omzet bulan ini, toko yang paling turun, atau rekomendasi produk untuk nama toko tertentu.",
      tampilan: [], konteks, source: "analis-rule",
    };
  }
  if (!h.ok) return { reply: `Maaf Bos, ${h.error}`, tampilan: [], konteks, source: "analis-rule" };
  return {
    reply: h.ringkasan.slice(0, 8).join("\n"),
    tampilan: h.tampilan ? [h.tampilan] : [],
    konteks: gabungKonteks(konteks, h), source: "analis-rule",
  };
}
