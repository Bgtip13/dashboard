import {
  EMPTY_OPTIONS, describeAction, normalizeParam, parseAsistenCommand, sanitizeAction,
  type AsistenOptions, type AsistenResult,
} from "@/lib/asisten";

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

const SYSTEM_PROMPT = `Kamu menerjemahkan perintah bahasa Indonesia menjadi aksi navigasi dashboard PCP.
Balas HANYA JSON tanpa penjelasan, bentuk: {"page":"...","params":{...}}

Halaman dan parameter yang valid:
- beranda: tanpa parameter
- bulanan: area (GLOBAL/SOLO/DIY/SEMARANG/TAB)
- mingguan: area (sama), minggu (ALL/M1/M2/M3/M4/M5)
- dap: area, kab, kec, q, bulan (0-11), trx (ALL/AKTIF/BAWAH/TANPA), alasan (ALL/BERHENTI/IDLE2/BELUM/TUTUP),
  urut (omsetYtd/aktual/targetToko/pcp/hilang/kontrib/avg/bulanPasif), arah (asc/desc)
- produk: area, kategori, brand, cari, urut (pj-desc/pj-asc/qty-desc/qty-asc)

Aturan:
- Isi hanya parameter yang benar-benar disebut pengguna.
- Nilai area/brand/kabupaten/kecamatan/kategori harus disalin persis dari "opsi" bila ada.
- Nama toko atau wilayah yang tidak ada di opsi taruh di q (dap) atau cari (produk).
- "tanpa transaksi"/"tidak order"/"hilang" -> trx TANPA. "di bawah target" -> trx BAWAH.
- Permintaan peringkat ("tertinggi", "terendah", "top") -> isi urut + arah, jangan taruh kata itu di q/cari.
- Jangan mengarang angka atau data. Kalau perintah tidak jelas, balas {"page":null}.`;

/** Panggil model (OpenAI-compatible). Null kalau tidak dikonfigurasi/gagal. */
async function viaModel(text: string, options: AsistenOptions): Promise<AsistenResult | null> {
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
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ perintah: text, opsi: options }) },
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

    const action = sanitizeAction(JSON.parse(content.slice(start, end + 1)));
    if (!action) return null;

    // bulan bisa dikirim sebagai nama ("Oktober") — normalisasi sekali lagi
    if (action.params.bulan) {
      const b = normalizeParam(action.page, "bulan", action.params.bulan);
      if (b) action.params.bulan = b;
      else delete action.params.bulan;
    }

    return { reply: describeAction(action), action, source: "ai" };
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

  const fromModel = await viaModel(text, options);
  const result = fromModel ?? parseAsistenCommand(text, options);

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
