import {
  EMPTY_OPTIONS, describeAction, normalizeParam, parseAsistenCommand, sanitizeAction,
  type AsistenOptions, type AsistenResult,
} from "@/lib/asisten";
import type { AsistenSnapshot } from "@/lib/asistenSnapshot";

const MAX_OPTIONS = 400;

// Pembatas sederhana supaya endpoint (dan kredit model, kalau aktif) tidak dibanjiri
const WINDOW_MS = 60_000;
const LIMIT = 30;
const hits = new Map<string, { count: number; reset: number }>();

function tooMany(key: string): boolean {
  const now = Date.now();
  if (hits.size > 500) {
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }
  const cur = hits.get(key);
  if (!cur || now > cur.reset) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > LIMIT;
}

/** Ambil daftar opsi dari klien, buang yang aneh/terlalu panjang. */
function readList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, MAX_OPTIONS);
}

function readOptions(input: unknown): AsistenOptions {
  if (!input || typeof input !== "object") return EMPTY_OPTIONS;
  const o = input as Record<string, unknown>;
  return {
    areas: readList(o.areas),
    kabupaten: readList(o.kabupaten),
    kecamatan: readList(o.kecamatan),
    brands: readList(o.brands),
    kategori: readList(o.kategori),
  };
}

const pickNumber = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;

const pickText = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const clean = v.replace(/\s+/g, " ").trim().slice(0, 60);
  return clean || undefined;
};

const MAX_AREA = 8;

/** Ringkasan dari klien dibersihkan: hanya field yang dikenal, angka dibulatkan. */
function readSnapshot(input: unknown): AsistenSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const periode = pickText(o.periode);
  const bulan = pickNumber(o.bulan);
  if (!periode || bulan === undefined || bulan < 0 || bulan > 11) return null;

  const snap: AsistenSnapshot = { periode, bulan };

  const b = o.bulanan;
  if (b && typeof b === "object") {
    const x = b as Record<string, unknown>;
    const target = pickNumber(x.target) ?? 0;
    const aktual = pickNumber(x.aktual) ?? 0;
    const areaRaw = Array.isArray(x.area) ? x.area : [];
    snap.bulanan = {
      target,
      aktual,
      pcp: pickNumber(x.pcp) ?? (target ? (aktual / target) * 100 : 0),
      area: areaRaw.slice(0, MAX_AREA).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const a = item as Record<string, unknown>;
        const nama = pickText(a.nama);
        if (!nama) return [];
        const t = pickNumber(a.target) ?? 0;
        const ac = pickNumber(a.aktual) ?? 0;
        return [{ nama, target: t, aktual: ac, pcp: pickNumber(a.pcp) ?? (t ? (ac / t) * 100 : 0) }];
      }),
    };
  }

  const toko = o.toko;
  if (toko && typeof toko === "object") {
    const x = toko as Record<string, unknown>;
    const topTurun = (Array.isArray(x.topTurun) ? x.topTurun : []).slice(0, 5).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const t = item as Record<string, unknown>;
      const nama = pickText(t.nama);
      if (!nama) return [];
      return [{
        nama,
        kabupaten: pickText(t.kabupaten) ?? "",
        sekarang: pickNumber(t.sekarang) ?? 0,
        sebelumnya: pickNumber(t.sebelumnya) ?? 0,
        selisih: pickNumber(t.selisih) ?? 0,
      }];
    });
    snap.toko = {
      total: pickNumber(x.total) ?? 0,
      tanpaTransaksi: pickNumber(x.tanpaTransaksi) ?? 0,
      bawahTarget: pickNumber(x.bawahTarget) ?? 0,
      hilangNominal: pickNumber(x.hilangNominal) ?? 0,
      turun: pickNumber(x.turun) ?? 0,
      naik: pickNumber(x.naik) ?? 0,
      turunNominal: pickNumber(x.turunNominal) ?? 0,
      topTurun,
    };
  }

  const produk = o.produk;
  if (produk && typeof produk === "object") {
    const x = produk as Record<string, unknown>;
    const list = (v: unknown) =>
      (Array.isArray(v) ? v : []).slice(0, 5).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const r = item as Record<string, unknown>;
        const nama = pickText(r.nama);
        const penjualan = pickNumber(r.penjualan);
        return nama && penjualan !== undefined ? [{ nama, penjualan }] : [];
      });
    snap.produk = { brand: list(x.brand), barang: list(x.barang) };
  }

  if (!snap.bulanan && !snap.toko && !snap.produk) return null;
  return snap;
}

const SYSTEM_PROMPT = `Kamu F.R.I.D.A.Y, asisten data PCP bergaya AI-nya Tony Stark: cekatan, sopan, dan memanggil pengguna "Bos".
Dua tugasmu: menjawab pertanyaan singkat tentang data dashboard, dan menerjemahkan perintah menjadi aksi navigasi.

Balas HANYA JSON valid tanpa markdown, bentuk:
{"reply":"...","page":null,"params":{}}

- "reply": 1-2 kalimat bahasa Indonesia yang enak diucapkan mesin suara (tanpa emoji, markdown, atau daftar). Sebut angka HANYA dari "ringkasan". Kalau angkanya tidak ada di ringkasan, jangan menjawab angkanya.
- "page": halaman yang perlu dibuka, atau null kalau cukup menjawab.
- "params": hanya parameter valid untuk halaman itu.

Halaman dan parameter yang valid:
- beranda: tanpa parameter
- bulanan: area (GLOBAL/SOLO/DIY/SEMARANG/TAB)
- mingguan: area (sama), minggu (ALL/M1/M2/M3/M4/M5)
- dap: area, kab, kec, q, bulan (0-11), trx (ALL/AKTIF/BAWAH/TANPA), alasan (ALL/BERHENTI/IDLE2/BELUM/TUTUP),
  tren (TURUN/NAIK — penjualan bulan ini vs bulan lalu),
  urut (omsetYtd/aktual/targetToko/pcp/hilang/selisih/kontrib/avg/bulanPasif), arah (asc/desc)
- produk: area, kategori, brand, cari, urut (pj-desc/pj-asc/qty-desc/qty-asc)

Aturan:
- Pengguna sering menulis santai/gaul: "liat", "gmn", "brp", "gak", "tokonya", "cuan", "jeblok", "nyampe target".
  Pahami maksudnya seperti bahasa baku, jangan menolak hanya karena bahasanya tidak formal.
- Balas dengan bahasa Indonesia yang luwes dan santai tapi sopan, singkat, tetap memanggil "Bos".
- Isi parameter hanya yang benar-benar disebut pengguna.
- Nilai area/brand/kabupaten/kecamatan/kategori harus disalin persis dari "opsi" bila ada.
- Nama toko atau wilayah yang tidak ada di opsi taruh di q (dap) atau cari (produk).
- "tanpa transaksi"/"tidak order"/"hilang" -> trx TANPA. "di bawah target" -> trx BAWAH.
- "penjualan turun"/"omset drop"/"anjlok" -> dap dengan tren TURUN, urut selisih, arah asc.
- "penjualan naik"/"meningkat" -> dap dengan tren NAIK, urut selisih, arah desc.
- Permintaan peringkat ("tertinggi", "terendah", "top") -> isi urut + arah, jangan taruh kata itu di q/cari.
- Sapaan, basa-basi, dan pertanyaan angka cukup dijawab di "reply" dengan page null.
- Kalau setelah ditafsirkan secara santai perintahnya tetap tidak jelas atau tidak berhubungan dengan data dashboard,
  balas PERSIS {"reply":"Saya tidak paham, Bos.","page":null,"params":{}}. Jangan menebak, jangan mengarang cerita.`;

/** Panggil model (OpenAI-compatible). Null kalau tidak dikonfigurasi/gagal. */
async function viaModel(
  text: string,
  options: AsistenOptions,
  snapshot: AsistenSnapshot | null,
): Promise<AsistenResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const base = (process.env.OPENAI_BASE_URL || "https://freebuff.com/api/v1/paid").replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              perintah: text,
              opsi: options,
              ringkasan: snapshot ?? "belum ada data dashboard yang termuat",
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) return null;

    const parsed: unknown = JSON.parse(content.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object") return null;

    const obj = parsed as Record<string, unknown>;
    const action = sanitizeAction({ page: obj.page, params: obj.params });
    const reply = typeof obj.reply === "string"
      ? obj.reply.replace(/\s+/g, " ").trim().slice(0, 400)
      : "";

    if (!action && !reply) return null;

    // bulan bisa dikirim sebagai nama ("Oktober") — normalisasi sekali lagi
    if (action?.params.bulan) {
      const b = normalizeParam(action.page, "bulan", action.params.bulan);
      if (b) action.params.bulan = b;
      else delete action.params.bulan;
    }

    return {
      reply: reply || describeAction(action!),
      action,
      source: "ai",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = typeof payload.text === "string" ? payload.text.trim().slice(0, 300) : "";
  if (!text) {
    return Response.json({ error: "Perintah masih kosong." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "lokal";
  if (tooMany(ip)) {
    return Response.json({ error: "Terlalu banyak permintaan, coba lagi sebentar." }, { status: 429 });
  }

  const options = readOptions(payload.options);
  const snapshot = readSnapshot(payload.snapshot);

  // Parser lokal dijalankan lebih dulu: hasilnya deterministik dan tervalidasi.
  const rule = parseAsistenCommand(text, options, new Date(), snapshot ?? undefined);
  const fromModel = await viaModel(text, options, snapshot);

  // Model hanya dipercaya untuk navigasi atau kalimat tanpa angka.
  // Semua angka tetap dijawab dari ringkasan lokal, jadi tidak ada jawaban karangan.
  let result: AsistenResult;
  if (fromModel?.action) result = fromModel;
  else if (rule.action) result = rule;
  else if (fromModel && !/\d/.test(fromModel.reply)) result = fromModel;
  else result = rule;

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
