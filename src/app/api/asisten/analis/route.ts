import { currentUser } from "@/lib/auth";
import { jalankanAnalis, type PesanRiwayat } from "@/lib/bisnis/analis";
import { dataUntuk, muatData } from "@/lib/bisnis/data";
import type { Konteks } from "@/lib/bisnis/engine";

// AI Business Analyst & Sales Advisor — read-only. Sesi wajib; data dibatasi hak akses tab pengguna.
export const maxDuration = 60;

const WINDOW_MS = 60_000;
const LIMIT = 15;
const hits = new Map<string, { count: number; reset: number }>();
function tooMany(key: string): boolean {
  const now = Date.now();
  if (hits.size > 500) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  const cur = hits.get(key);
  if (!cur || now > cur.reset) { hits.set(key, { count: 1, reset: now + WINDOW_MS }); return false; }
  cur.count += 1;
  return cur.count > LIMIT;
}

const teks = (v: unknown, n: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim().slice(0, n);
  return s || undefined;
};

/** Konteks dari klien hanya petunjuk nama; semuanya divalidasi ulang terhadap data oleh engine. */
function bacaKonteks(v: unknown): Konteks {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const periode = teks(o.periode, 20);
  return {
    toko: teks(o.toko, 80), produk: teks(o.produk, 80),
    periode: periode === "minggu_ini" || periode === "bulan_ini" || periode === "bulan_lalu" ? periode : undefined,
    topik: teks(o.topik, 40),
    daftarToko: Array.isArray(o.daftarToko) ? o.daftarToko.map((x) => teks(x, 80)).filter((x): x is string => !!x).slice(0, 10) : undefined,
  };
}

function bacaRiwayat(v: unknown): PesanRiwayat[] {
  if (!Array.isArray(v)) return [];
  return v.slice(-8).flatMap((m) => {
    if (!m || typeof m !== "object") return [];
    const o = m as Record<string, unknown>;
    const content = teks(o.content, 700);
    const role = o.role === "user" || o.role === "assistant" ? o.role : null;
    return role && content ? [{ role, content }] : [];
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Belum login." }, { status: 401 });

  const izin = { dap: user.tabs.includes("dap"), produk: user.tabs.includes("produk") };
  if (!izin.dap && !izin.produk) {
    return Response.json({ error: "Akun ini tidak punya akses ke data DAP maupun Produk." }, { status: 403 });
  }
  if (tooMany(user.id)) {
    return Response.json({ error: "Terlalu banyak permintaan, coba lagi sebentar." }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }
  const p = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = teks(p.text, 300);
  if (!text) return Response.json({ error: "Pertanyaan masih kosong." }, { status: 400 });

  const cache = await muatData();
  if (!cache.dap && !cache.produk) {
    return Response.json({ error: `Data belum bisa dibaca dari Google Sheets. ${cache.galat.join("; ")}` }, { status: 502 });
  }

  const hasil = await jalankanAnalis({
    text, riwayat: bacaRiwayat(p.history), konteks: bacaKonteks(p.konteks), data: dataUntuk(cache, izin),
  });
  return Response.json(
    { reply: hasil.reply, action: null, source: hasil.source, tampilan: hasil.tampilan, konteks: hasil.konteks },
    { headers: { "Cache-Control": "no-store" } },
  );
}
