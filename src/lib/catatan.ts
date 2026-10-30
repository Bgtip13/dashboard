/** Catatan bebas (agenda rapat, ide, rencana) — disimpan di localStorage peramban. */

export type Catatan = {
  id: string;
  judul: string;
  isi: string; // HTML dari editor
  dibuat: number;
  diubah: number;
};

const KEY = "pcp-catatan-v1";
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function idCatatan(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Timestamp ringkas: "Hari ini 14.05", "Kemarin 09.10", "26 Okt 16.42" */
export function waktuSingkat(ts: number, now = new Date()): string {
  const d = new Date(ts);
  const jam = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return `Hari ini ${jam}`;
  const kemarin = new Date(now);
  kemarin.setDate(now.getDate() - 1);
  if (d.toDateString() === kemarin.toDateString()) return `Kemarin ${jam}`;
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${jam}`;
}

/** Teks polos dari HTML — aman dipanggil saat render server. */
export function teksDari(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent ?? "";
}

export function judulDari(isi: string): string {
  const baris = teksDari(isi).split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";
  return baris.length > 60 ? `${baris.slice(0, 60).trim()}…` : baris;
}

export function cuplikan(isi: string): string {
  const t = teksDari(isi).replace(/\s+/g, " ").trim();
  return t.length > 90 ? `${t.slice(0, 90).trim()}…` : t;
}

/** Buang elemen & atribut berbahaya dari HTML yang masuk (tempelan dari luar/Word). */
export function bersihkanHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="akar">${html}</div>`, "text/html");
  const akar = doc.getElementById("akar");
  if (!akar) return "";
  akar.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button").forEach((n) => n.remove());
  akar.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const nama = a.name.toLowerCase();
      const nilai = a.value.trim().toLowerCase();
      if (nama.startsWith("on")) el.removeAttribute(a.name);
      else if ((nama === "href" || nama === "src") && nilai.startsWith("javascript:")) el.removeAttribute(a.name);
    }
  });
  return akar.innerHTML;
}

export function muatCatatan(): Catatan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((c): c is Partial<Catatan> => !!c && typeof (c as Catatan).id === "string")
      .map((c) => ({
        id: String(c.id),
        judul: typeof c.judul === "string" ? c.judul : "",
        isi: typeof c.isi === "string" ? bersihkanHtml(c.isi) : "",
        dibuat: Number(c.dibuat) || Date.now(),
        diubah: Number(c.diubah) || Date.now(),
      }));
  } catch {
    return [];
  }
}

export function simpanCatatan(list: Catatan[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/* ---------- store kecil di atas localStorage (dipakai useSyncExternalStore) ---------- */
let cache: Catatan[] | null = null;
const pendengar = new Set<() => void>();
const KOSONG: Catatan[] = [];

/** Snapshot klien: dibaca sekali lalu di-cache agar referensinya stabil. */
export function daftarCatatan(): Catatan[] {
  if (cache === null) cache = muatCatatan().sort((a, b) => b.diubah - a.diubah);
  return cache;
}

/** Snapshot server: tidak ada localStorage saat render server. */
export function daftarServer(): Catatan[] {
  return KOSONG;
}

export function langganan(cb: () => void): () => void {
  pendengar.add(cb);
  return () => { pendengar.delete(cb); };
}

/** Simpan daftar terbaru (HTML dibersihkan) lalu beri tahu pelanggan store. */
export function tulisCatatan(list: Catatan[]): void {
  const bersih = list.map((c) => ({ ...c, isi: bersihkanHtml(c.isi) }));
  cache = bersih;
  simpanCatatan(bersih);
  pendengar.forEach((l) => l());
}

/** Kerangka agenda rapat siap isi. */
export function agendaContoh(now = new Date()): string {
  const tgl = now.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return [
    `<h2>Agenda Rapat — ${tgl}</h2>`,
    `<p><b>Waktu:</b> 09.00 – 10.00</p>`,
    `<p><b>Peserta:</b> …</p>`,
    `<h3>Pembahasan</h3>`,
    `<ol><li>…</li><li>…</li></ol>`,
    `<h3>Keputusan</h3>`,
    `<ul><li>…</li></ul>`,
    `<h3>Tindak lanjut</h3>`,
    `<ul><li>☐ …</li></ul>`,
  ].join("");
}
