/**
 * F.R.I.D.A.Y — menerjemahkan perintah bahasa Indonesia menjadi aksi navigasi
 * (halaman + filter) di dashboard. Dipakai server (parse) dan klien (URL).
 *
 * Prinsip: kalau perintah tidak jelas, jangan membuka halaman kosong dan jangan
 * mengarang jawaban — cukup balas "Saya tidak paham, Bos." supaya pengguna tahu
 * perintahnya tidak dikenali (bukan salah data).
 */

import { answerFromSnapshot, type AsistenSnapshot } from "./asistenSnapshot";

export const ASISTEN_PAGES = ["beranda", "bulanan", "mingguan", "dap", "produk"] as const;
export type AsistenPage = (typeof ASISTEN_PAGES)[number];

export interface AsistenOptions {
  areas: string[];
  kabupaten: string[];
  kecamatan: string[];
  brands: string[];
  kategori: string[];
}

export const EMPTY_OPTIONS: AsistenOptions = {
  areas: [], kabupaten: [], kecamatan: [], brands: [], kategori: [],
};

export interface AsistenAction {
  page: AsistenPage;
  params: Record<string, string>;
}

export interface AsistenResult {
  reply: string;
  action: AsistenAction | null;
  source: "ai" | "rule";
}

const ALLOWED_PARAMS: Record<AsistenPage, readonly string[]> = {
  beranda: [],
  bulanan: ["area"],
  mingguan: ["area", "minggu"],
  dap: ["area", "kab", "kec", "q", "bulan", "trx", "alasan", "tren", "urut", "arah"],
  produk: ["area", "kategori", "brand", "cari", "urut"],
};

const TRX = ["ALL", "AKTIF", "BAWAH", "TANPA"] as const;
const TREN = ["ALL", "TURUN", "NAIK"] as const;
const ALASAN = ["ALL", "BERHENTI", "IDLE2", "BELUM", "TUTUP"] as const;
const PRODUK_URUT = ["pj-desc", "pj-asc", "qty-desc", "qty-asc"] as const;
export const DAP_SORT_KEYS = [
  "area", "kabupaten", "kecamatan", "toko", "adm", "kelasToko", "aktual",
  "omsetYtd", "kontrib", "avg", "bulanPasif", "targetToko", "hilang", "selisih",
  "status", "pcp",
] as const;

export const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const TRX_LABEL: Record<string, string> = {
  ALL: "semua toko",
  AKTIF: "toko ada transaksi",
  BAWAH: "toko di bawah target",
  TANPA: "toko tanpa transaksi",
};

const ALASAN_LABEL: Record<string, string> = {
  ALL: "",
  BERHENTI: "berhenti bulan ini",
  IDLE2: "kosong ≥ 2 bulan",
  BELUM: "belum pernah transaksi",
  TUTUP: "tutup / do not order",
};

const PRODUK_URUT_LABEL: Record<string, string> = {
  "pj-desc": "penjualan tertinggi",
  "pj-asc": "penjualan terendah",
  "qty-desc": "qty terbanyak",
  "qty-asc": "qty tersedikit",
};

const DAP_SORT_LABEL: Record<string, string> = {
  area: "area", kabupaten: "kabupaten", kecamatan: "kecamatan", toko: "nama toko", adm: "ADM",
  kelasToko: "kelas toko", aktual: "aktual bulan ini", omsetYtd: "omset YTD",
  kontrib: "kontribusi", avg: "rata-rata per bulan", bulanPasif: "bulan pasif",
  targetToko: "target toko", hilang: "nominal hilang", selisih: "selisih vs bulan lalu",
  status: "status", pcp: "PCP",
};

const TREN_LABEL: Record<string, string> = {
  ALL: "",
  TURUN: "penjualan turun vs bulan lalu",
  NAIK: "penjualan naik vs bulan lalu",
};

/** Jawaban wajib saat perintah tidak dikenali — jangan menebak, jangan mengarang. */
export const TIDAK_PAHAM = "Saya tidak paham, Bos.";

export const HELP_REPLY = [
  "Saya F.R.I.D.A.Y — bisa membuka data apa pun di dashboard ini. Contoh perintah:",
  "• “buka DAP toko tanpa transaksi di Semarang”",
  "• “buka penjualan yang turun bulan ini” — daftar toko menurun, urut penurunan terbesar",
  "• “toko omset tertinggi kabupaten Sleman”",
  "• “buka produk brand Wardah urut qty terbanyak”",
  "• “pencapaian bulanan area DIY” / “pencapaian mingguan area Solo minggu 2”",
  "• “berapa pencapaian bulan ini?” — saya jawab angkanya langsung",
  "Sebutkan halaman (DAP, Produk, Bulanan, Mingguan), wilayah, brand, atau bulan yang diinginkan. Di browser yang mendukung, tekan ikon mikrofon untuk memberi perintah lewat suara.",
].join("\n");

/**
 * Kamus bahasa santai/gaul → kata baku. Dibaca per kata, jadi kalimat campuran
 * ("liat tokonya yang jeblok gak sih") tetap bisa dipahami tanpa mengubah tabel
 * frase baku di bawah.
 */
const SANTAI: Record<string, string> = {
  // kata tanya & sapaan
  gmn: "gimana", gmna: "gimana", gmana: "gimana", gimane: "gimana", piye: "gimana",
  brp: "berapa", brapa: "berapa",
  woy: "halo", woi: "halo", p: "halo", assalamualaikum: "halo", assalam: "halo", permisi: "halo",
  // kata kerja
  liat: "lihat", liatin: "lihat", lihin: "lihat", lht: "lihat", tengok: "lihat", intip: "lihat",
  tampilin: "tampilkan", tunjukin: "tunjukkan", bukain: "buka",
  kasih: "tampilkan", kasihin: "tampilkan", munculin: "tampilkan", open: "buka", show: "tampilkan",
  check: "cek",
  // negasi & kata sambung santai
  gak: "tidak", ga: "tidak", gk: "tidak", nggak: "tidak", enggak: "tidak", kagak: "tidak",
  tdk: "tidak", yg: "yang", dgn: "dengan", krn: "karena", udh: "sudah", udah: "sudah",
  // benda
  duit: "omset", duitnya: "omset", cuan: "omset", cuannya: "omset", pemasukan: "omset",
  revenue: "omset", turnover: "omset", omsetnya: "omset", omzetnya: "omzet",
  jualannya: "penjualan", penjualannya: "penjualan", salesnya: "penjualan",
  tokonya: "toko", toko2: "toko", outlet: "toko", outletya: "toko", tokoe: "toko",
  barangnya: "barang", barang2: "barang", brg: "barang",
  produknya: "produk", mereknya: "brand", brandnya: "brand",
  areanya: "area", daerahnya: "daerah", wilayahnya: "wilayah",
  // tren
  jeblok: "anjlok", ambyar: "anjlok", ambruk: "anjlok", kolaps: "anjlok", hancur: "anjlok",
  terjun: "anjlok", plunging: "anjlok",
  nambah: "naik", moncer: "naik", melesat: "naik", meroket: "naik",
  // target
  nyampe: "capai", nyampek: "capai", sampe: "capai", sampek: "capai", kekejar: "capai",
};

const rapikan = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

/** Normalisasi teks + terjemahan kata santai, dipakai seluruh pencocokan di file ini. */
const norm = (s: string) =>
  rapikan(s)
    .split(" ")
    .filter(Boolean)
    .map((w) => SANTAI[w] ?? w)
    .join(" ");

const tokens = (s: string) => norm(s).split(" ").filter(Boolean);

/* --------------------------- percakapan ringan --------------------------- */

const STOP_TOKENS = new Set([
  "stop", "diam", "berhenti", "cukup", "batal", "batalkan", "senyap", "sst", "sudah",
  "jangan", "bicara", "ngomong", "suara", "dulu", "ya", "bos", "sebentar", "matikan",
  "matiin", "mute", "saja", "aja",
]);

/** Perintah untuk menghentikan suara F.R.I.D.A.Y — bukan filter data. */
export function isStopCommand(raw: string): boolean {
  const t = tokens(raw);
  if (!t.length || t.length > 4) return false;
  if (!t.every((w) => STOP_TOKENS.has(w))) return false;
  return t.some((w) =>
    ["stop", "diam", "berhenti", "cukup", "batal", "batalkan", "senyap", "sst", "matikan", "matiin", "mute", "jangan"].includes(w)
  );
}

const GREETING_TOKENS = new Set([
  "halo", "hallo", "hai", "hi", "hey", "helo", "pagi", "siang", "sore", "malam",
  "selamat", "friday", "bos", "boss", "ya", "dong", "semua", "bro", "bre", "sis",
  "min", "kak", "gan", "mas", "mbak", "permisi",
  // "woy min mau tanya dong" tetap dianggap sapaan
  "tanya", "nanya", "mau", "mo", "minta", "boleh", "izin", "nih", "sih",
]);

const GREETING_WORDS = ["halo", "hallo", "hai", "hi", "hey", "helo", "pagi", "siang", "sore", "malam", "selamat"];

const QUESTION_WORDS = new Set([
  "berapa", "brp", "berapakah", "gimana", "bagaimana", "apa", "apakah", "mana", "manakah",
  "total", "jumlah", "sekarang",
]);

/** Jam WIB, supaya sapaan & jawaban jam konsisten di server maupun klien. */
function jamJakarta(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(now)
  );
}

function sapaJam(now: Date): string {
  const jam = jamJakarta(now);
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Sapaan, identitas, kemampuan, terima kasih, dan jam — tanpa perlu model. */
function conversationReply(n: string, now: Date): AsistenResult | null {
  const t = n.split(" ").filter(Boolean);
  if (!t.length) return null;

  if (/jam berapa|pukul berapa|sekarang jam|tanggal berapa|hari apa/.test(n)) {
    const teks = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long",
      year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
    return { reply: `Sekarang ${teks} WIB, Bos.`, action: null, source: "rule" };
  }

  if (/siapa kamu|kamu siapa|nama kamu|friday (itu )?siapa|kenalan|perkenalkan diri/.test(n)) {
    return {
      reply: "Saya F.R.I.D.A.Y, asisten data PCP Anda. Saya bisa membuka halaman, menyaring toko, dan menjawab angka ringkasan — lewat ketik maupun suara, Bos.",
      action: null,
      source: "rule",
    };
  }

  if (/bisa apa|apa saja .*bisa|kemampuan|fitur|^bantuan$|^help$|cara pakai|gimana cara|cara menggunakan|apa yang bisa/.test(n)) {
    return { reply: HELP_REPLY, action: null, source: "rule" };
  }

  if (t.length <= 5 && /makasih|terima kasih|thanks|thank you|tq/.test(n)) {
    return { reply: "Siap, Bos. Kalau butuh data lain, panggil saja saya.", action: null, source: "rule" };
  }

  if (t.every((w) => GREETING_TOKENS.has(w)) && t.some((w) => GREETING_WORDS.includes(w))) {
    return {
      reply: `${sapaJam(now)}, Bos. F.R.I.D.A.Y online dan semua sistem siap. Mau saya bukakan data apa hari ini?`,
      action: null,
      source: "rule",
    };
  }

  // basa-basi santai: "lagi apa", "gimana kabar", "sibuk ga"
  if (t.length <= 6 && /lagi apa|lagi ngapain|ngapain|sibuk|kabar|baik baik|baik2|sehat/.test(n)) {
    return {
      reply: `Siap siaga terus, Bos. Mau saya bukakan data yang mana? Sebut saja halaman atau tokonya.`,
      action: null,
      source: "rule",
    };
  }

  // akronim persetujuan singkat: "sip", "oke", "mantap"
  if (t.length <= 3 && t.every((w) => ["sip", "siap", "oke", "ok", "okey", "mantap", "mantul", "nice", "keren", "bagus", "woke", "santai"].includes(w))) {
    return { reply: "Siap, Bos. Panggil saja kalau butuh data lagi.", action: null, source: "rule" };
  }

  return null;
}

/** nama bulan (token utuh, supaya "mei" tidak ikut mencocokkan kata lain) */
const MONTH_WORDS: [string, number][] = [
  ["januari", 0], ["jan", 0],
  ["februari", 1], ["feb", 1],
  ["maret", 2], ["mar", 2],
  ["april", 3], ["apr", 3],
  ["mei", 4],
  ["juni", 5], ["jun", 5],
  ["juli", 6], ["jul", 6],
  ["agustus", 7], ["agu", 7], ["agt", 7],
  ["september", 8], ["sep", 8],
  ["oktober", 9], ["okt", 9],
  ["november", 10], ["nov", 10],
  ["desember", 11], ["des", 11],
];

const WORD_NUM: Record<string, number> = {
  satu: 1, pertama: 1, dua: 2, kedua: 2, tiga: 3, ketiga: 3,
  empat: 4, keempat: 4, lima: 5, kelima: 5,
};

/** Indeks bulan (0–11) dari teks bebas, null kalau tidak disebut. */
export function monthFromText(text: string, now = new Date()): number | null {
  const t = tokens(text);
  if (t.includes("lalu") || t.includes("kemarin") || t.includes("sebelumnya")) {
    return Math.max(0, now.getMonth() - 1);
  }
  for (const [w, i] of MONTH_WORDS) if (t.includes(w)) return i;

  // "bulan 9" / "bulan ke 9" -> indeks 8
  const bi = t.indexOf("bulan");
  const next = bi >= 0 ? t[bi + 1] : undefined;
  if (next && /^\d{1,2}$/.test(next)) {
    const n = Number(next);
    if (n >= 1 && n <= 12) return n - 1;
  }

  if (t.includes("ini")) return now.getMonth();
  return null;
}

const STOPWORDS = new Set(
  `buka bukakan bukain tampilkan tampil lihat tunjukkan cari carikan filter saring data untuk yang di ke dari dan atau
   semua saya aku mau ingin tolong dong ya aja saja itu ini bulan bln tahun toko toko-toko pelanggan area wilayah
   kabupaten kecamatan kota produk brand merek barang minggu mingguan bulanan dap halaman menu pada dengan per target
   penjualan transaksi bawah atas tanpa ada belum sudah order tidak tak gak nggak kurang lebih paling nominal hilang
   tutup aktif berhenti idle alasan urutkan urut tertinggi terendah terbesar terkecil top juga agar biar bisa kah apa
   apakah sedang saat sekarang minta bantu bantuan buatkan buat berdasarkan mana saja seluruh semuanya periode
   pencapaian ringkasan penjualannya datanya tokonya yang mana daerah kawasan sekitar bagian dalam tepatnya yaitu
   adalah terhadap cuma hanya omset aktual pcp kontribusi kontrib avg rata pasif status ytd urutan sortir sort
   ranking peringkat tampilin carikan bantu bantuannya mohon silakan dicek cek cekin qty kuantitas kategori
   sih deh nih tuh kok kan lah kah min kak gan mas mbak bre sis boss banget bgt gitu gt yah ah eh mah
   donk dunk yuk ayo mari segera doang aja nih
   gimana bagaimana berapa berapakah apa apakah mana manakah kenapa mengapa kok total jumlah sekarang`
    .split(/\s+/)
    .filter(Boolean)
);

const COMMAND_VERBS = [
  "buka", "bukakan", "bukain", "tampilkan", "tampil", "tampilin", "lihat", "tunjukkan", "cari",
  "carikan", "filter", "saring", "urutkan", "urutin", "sortir", "sort", "cek", "cekin",
];
const SEARCH_VERBS = ["cari", "carikan", "temukan", "temuin", "search", "cek", "cekin"];

const PAGE_WORDS: Record<AsistenPage, readonly string[]> = {
  produk: ["produk", "barang", "brand", "merek", "sku", "item", "artikel"],
  mingguan: ["minggu", "mingguan", "week", "w1", "w2", "w3", "w4", "w5"],
  dap: [
    "dap", "toko", "tokonya", "outlet", "pelanggan", "kabupaten", "kecamatan", "churn",
    "omset", "omzet", "penjualan", "jualan", "sales",
  ],
  bulanan: ["bulanan", "pencapaian", "target", "gauge", "ringkasan", "performa", "performa"],
  beranda: ["beranda", "home", "dashboard", "halaman utama", "awal", "utama"],
};

const TRX_PHRASES: [string, string][] = [
  ["tanpa transaksi", "TANPA"],
  ["tidak transaksi", "TANPA"],
  ["nggak transaksi", "TANPA"],
  ["gak transaksi", "TANPA"],
  ["tanpa order", "TANPA"],
  ["tidak order", "TANPA"],
  ["nggak order", "TANPA"],
  ["gak order", "TANPA"],
  ["belum order", "TANPA"],
  ["no order", "TANPA"],
  ["no sales", "TANPA"],
  ["zero sales", "TANPA"],
  ["tidak ada transaksi", "TANPA"],
  ["tidak ada order", "TANPA"],
  ["hilang", "TANPA"],
  ["kosong", "TANPA"],
  ["pasif", "TANPA"],
  ["sepi", "TANPA"],
  ["mandek", "TANPA"],
  ["stalled", "TANPA"],
  ["inactive", "TANPA"],
  ["di bawah target", "BAWAH"],
  ["dibawah target", "BAWAH"],
  ["bawah target", "BAWAH"],
  ["below target", "BAWAH"],
  ["under target", "BAWAH"],
  ["kurang target", "BAWAH"],
  ["tidak capai target", "BAWAH"],
  ["tidak mencapai target", "BAWAH"],
  ["gagal capai target", "BAWAH"],
  ["tidak laku", "TANPA"],
  ["kurang laku", "TANPA"],
  ["sepi order", "TANPA"],
  // "kejar/nyampe target" sudah dinormalkan jadi "capai target"
  ["capai target", "BAWAH"],
  ["ada transaksi", "AKTIF"],
  ["ada order", "AKTIF"],
  ["has transaction", "AKTIF"],
  ["masih order", "AKTIF"],
  ["aktif", "AKTIF"],
  ["active", "AKTIF"],
];

const ALASAN_PHRASES: [string, string][] = [
  ["belum pernah", "BELUM"],
  ["belum pernah transaksi", "BELUM"],
  ["belum pernah order", "BELUM"],
  ["toko baru", "BELUM"],
  ["baru", "BELUM"],
  ["tutup", "TUTUP"],
  ["closed", "TUTUP"],
  ["do not order", "TUTUP"],
  ["tidak boleh order", "TUTUP"],
  ["nonaktif", "TUTUP"],
  ["2 bulan", "IDLE2"],
  ["dua bulan", "IDLE2"],
  ["idle", "IDLE2"],
  ["berhenti", "BERHENTI"],
  ["stop order", "BERHENTI"],
  ["churn", "BERHENTI"],
];

/** Kata yang menandakan tren penjualan bulan ini vs bulan sebelumnya. */
const TREN_PHRASES: [string, "TURUN" | "NAIK"][] = [
  ["turun", "TURUN"], ["menurun", "TURUN"], ["penurunan", "TURUN"], ["turunnya", "TURUN"],
  ["anjlok", "TURUN"], ["merosot", "TURUN"], ["melorot", "TURUN"], ["menyusut", "TURUN"],
  ["melemah", "TURUN"], ["lesu", "TURUN"], ["drop", "TURUN"], ["decline", "TURUN"],
  ["naik", "NAIK"], ["kenaikan", "NAIK"], ["meningkat", "NAIK"], ["meningkatnya", "NAIK"],
  ["tumbuh", "NAIK"], ["growth", "NAIK"],
  ["turun drastis", "TURUN"], ["turun jauh", "TURUN"],
  ["naik terus", "NAIK"], ["naik pesat", "NAIK"],
];

const OMSET_WORDS = ["omset", "omzet", "penjualan", "jualan", "sales"];

const AREA_ALIAS: Record<string, string> = {
  jogja: "DIY", jogjakarta: "DIY", jogya: "DIY", yogyakarta: "DIY", yogya: "DIY", diy: "DIY",
  smg: "SEMARANG", semarang: "SEMARANG",
  solo: "SOLO", surakarta: "SOLO",
  tab: "TAB", tabungan: "TAB", cabang: "CABANG", global: "GLOBAL",
};

const ASC_WORDS = ["terendah", "tersedikit", "terkecil", "sedikit", "rendah", "bottom", "asc", "under"];
const DESC_WORDS = ["tertinggi", "terbesar", "terbanyak", "tinggi", "besar", "banyak", "top", "desc", "teratas", "laris"];
const SORT_VERBS = ["urutkan", "urutin", "urut", "sortir", "sort", "ranking", "peringkat", "top", "paling"];

const DAP_METRICS: [string, string][] = [
  ["omset", "omsetYtd"],
  ["penjualan", "omsetYtd"],
  ["aktual", "aktual"],
  ["realisasi", "aktual"],
  ["target", "targetToko"],
  ["pcp", "pcp"],
  ["pencapaian", "pcp"],
  ["hilang", "hilang"],
  ["rugi", "hilang"],
  ["kontribusi", "kontrib"],
  ["kontrib", "kontrib"],
  ["avg", "avg"],
  ["pasif", "bulanPasif"],
];

/** jarak edit sederhana — untuk toleransi salah ketik nama wilayah/brand */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function fuzzyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const max = Math.max(a.length, b.length) >= 7 ? 2 : 1;
  return Math.abs(a.length - b.length) <= max && levenshtein(a, b) <= max;
}

const containsPhrase = (text: string, phrase: string) => {
  const p = norm(phrase);
  if (!p) return false;
  return ` ${text} `.includes(` ${p} `);
};

/** Cari opsi yang disebut di teks; opsi terpanjang diprioritaskan, salah ketik ditoleransi. */
function matchOption(text: string, options: string[]): string | null {
  const sorted = [...options].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const o of sorted) if (containsPhrase(text, o)) return o;

  const t = tokens(text);
  for (const o of sorted) {
    const ot = tokens(o);
    if (ot.length > 0 && ot.every((w) => t.some((x) => fuzzyEqual(x, w)))) return o;
  }
  return null;
}

function matchArea(text: string, options: string[], t: string[]): string | null {
  const fromOptions = matchOption(text, options);
  if (fromOptions) return fromOptions.toUpperCase();
  for (const [alias, area] of Object.entries(AREA_ALIAS)) {
    if (t.includes(alias)) return area;
  }
  // salah ketik nama area (mis. "semrang") tetap dikenali
  for (const [alias, area] of Object.entries(AREA_ALIAS)) {
    if (alias.length >= 5 && t.some((x) => fuzzyEqual(x, alias))) return area;
  }
  return null;
}

function matchProdukUrut(t: string[]): string | null {
  const qty = t.includes("qty") || t.includes("kuantitas") || t.includes("jumlah");
  if (t.includes("terendah") || t.includes("tersedikit") || t.includes("terkecil") || t.includes("asc")) {
    return qty ? "qty-asc" : "pj-asc";
  }
  if (t.includes("tertinggi") || t.includes("terbanyak") || t.includes("terbesar") || t.includes("desc") || t.includes("top") || t.includes("laris")) {
    return qty ? "qty-desc" : "pj-desc";
  }
  return null;
}

function matchMinggu(t: string[]): string | null {
  const direct = t.find((w) => /^w[1-5]$/.test(w));
  if (direct) return `M${direct.slice(1)}`;
  const pos = t.findIndex((w) => w === "minggu" || w === "week");
  if (pos >= 0) {
    let j = pos + 1;
    if (t[j] === "ke" || t[j] === "yang") j += 1;
    const v = t[j];
    if (v && /^[1-5]$/.test(v)) return `M${v}`;
    if (v && WORD_NUM[v]) return `M${WORD_NUM[v]}`;
  }
  const w = t.find((x) => WORD_NUM[x]);
  return w ? `M${WORD_NUM[w]}` : null;
}

function detectDapSort(t: string[]): { key: string; dir: "asc" | "desc" } | null {
  const metric = DAP_METRICS.find(([word]) => t.includes(word))?.[1];
  if (!metric) return null;
  const wantsAsc = t.some((w) => ASC_WORDS.includes(w));
  const wantsDesc = t.some((w) => DESC_WORDS.includes(w));
  const hasSortIntent = wantsAsc || wantsDesc || t.some((w) => SORT_VERBS.includes(w));
  if (!hasSortIntent) return null;
  return { key: metric, dir: wantsAsc && !wantsDesc ? "asc" : "desc" };
}

/** Validasi + normalisasi satu nilai parameter dari model/hasil parse. */
export function normalizeParam(page: AsistenPage, key: string, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!ALLOWED_PARAMS[page].includes(key)) return null;

  switch (key) {
    case "area": {
      const up = v.toUpperCase();
      return up === "ALL" || up === "SEMUA" ? null : up.slice(0, 40);
    }
    case "bulan": {
      const m = monthIndexFromValue(v);
      return m === null ? null : String(m);
    }
    case "trx": {
      const up = v.toUpperCase();
      return (TRX as readonly string[]).includes(up) ? up : null;
    }
    case "alasan": {
      const up = v.toUpperCase();
      return (ALASAN as readonly string[]).includes(up) ? up : null;
    }
    case "tren": {
      const up = v.toUpperCase();
      return (TREN as readonly string[]).includes(up) ? up : null;
    }
    case "urut": {
      if (page === "dap") {
        const key2 = DAP_SORT_KEYS.find((k) => k.toLowerCase() === v.toLowerCase());
        return key2 ?? null;
      }
      const low = v.toLowerCase();
      return (PRODUK_URUT as readonly string[]).includes(low) ? low : null;
    }
    case "arah": {
      const low = v.toLowerCase();
      return low === "asc" || low === "desc" ? low : null;
    }
    case "minggu": {
      const up = v.toUpperCase();
      if (up === "ALL") return "ALL";
      if (/^M[1-5]$/.test(up)) return up;
      if (/^[1-5]$/.test(up)) return `M${up}`;
      const w = WORD_NUM[v.toLowerCase()];
      return w ? `M${w}` : null;
    }
    default:
      return v.slice(0, 80);
  }
}

function monthIndexFromValue(v: string): number | null {
  const s = v.trim();
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 0 && n <= 11 ? n : null;
  }
  return monthFromText(s);
}

/** Ubah keluaran model (JSON tak tepercaya) menjadi aksi yang aman. */
export function sanitizeAction(input: unknown): AsistenAction | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const page = typeof obj.page === "string" && (ASISTEN_PAGES as readonly string[]).includes(obj.page)
    ? (obj.page as AsistenPage)
    : null;
  if (!page) return null;

  const raw = obj.params && typeof obj.params === "object" ? (obj.params as Record<string, unknown>) : {};
  const params: Record<string, string> = {};
  for (const key of ALLOWED_PARAMS[page]) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    const clean = normalizeParam(page, key, String(value));
    if (clean) params[key] = clean;
  }
  return { page, params };
}

/** Kalimat konfirmasi yang sama untuk hasil model maupun parser bawaan. */
export function describeAction(action: AsistenAction): string {
  const p = action.params;
  const parts: string[] = [];

  if (action.page === "beranda") {
    return "Membuka beranda PCP Dashboard.";
  }

  if (action.page === "bulanan") {
    return `Membuka pencapaian bulanan${p.area ? ` area ${p.area}` : " semua area"}.`;
  }

  if (action.page === "mingguan") {
    if (p.area) parts.push(`area ${p.area}`);
    if (p.minggu && p.minggu !== "ALL") parts.push(`minggu ${p.minggu.slice(1)}`);
    return `Membuka pencapaian mingguan${parts.length ? ` ${parts.join(" · ")}` : ""}.`;
  }

  if (action.page === "produk") {
    if (p.area) parts.push(`area ${p.area}`);
    if (p.kategori) parts.push(`kategori ${p.kategori}`);
    if (p.brand) parts.push(`brand ${p.brand}`);
    if (p.cari) parts.push(`pencarian "${p.cari}"`);
    if (p.urut) parts.push(PRODUK_URUT_LABEL[p.urut] ?? p.urut);
    return `Membuka penjualan produk${parts.length ? ` · ${parts.join(" · ")}` : ""}.`;
  }

  if (p.area) parts.push(`area ${p.area}`);
  if (p.kab) parts.push(`kabupaten ${p.kab}`);
  if (p.kec) parts.push(`kecamatan ${p.kec}`);
  if (p.bulan) parts.push(`periode ${BULAN[Number(p.bulan)] ?? p.bulan}`);
  if (p.tren && p.tren !== "ALL") parts.push(TREN_LABEL[p.tren] ?? p.tren);
  if (p.trx) parts.push(TRX_LABEL[p.trx] ?? p.trx);
  if (p.alasan && p.alasan !== "ALL") parts.push(ALASAN_LABEL[p.alasan] ?? p.alasan);
  if (p.urut) {
    const label = DAP_SORT_LABEL[p.urut] ?? p.urut;
    parts.push(p.arah === "asc" ? `urut ${label} terendah` : `urut ${label} tertinggi`);
  }
  if (p.q) parts.push(`pencarian "${p.q}"`);
  return `Membuka DAP — Detail Toko${parts.length ? ` · ${parts.join(" · ")}` : ""}.`;
}

/** Halaman yang paling masuk akal dari kata kunci yang disebut. */
function detectPage(t: string[]): AsistenPage | null {
  if (t.some((w) => PAGE_WORDS.produk.includes(w))) return "produk";
  if (t.some((w) => PAGE_WORDS.mingguan.includes(w))) return "mingguan";
  if (t.some((w) => PAGE_WORDS.dap.includes(w))) return "dap";
  if (t.some((w) => PAGE_WORDS.bulanan.includes(w))) return "bulanan";
  if (t.some((w) => PAGE_WORDS.beranda.includes(w))) return "beranda";
  return null;
}

/** Parser bawaan tanpa model: menangani perintah umum dan tahan salah ketik. */
export function parseAsistenCommand(
  raw: string,
  options: AsistenOptions,
  now = new Date(),
  snapshot?: AsistenSnapshot,
): AsistenResult {
  const text = raw.trim();
  const n = norm(text);
  if (!n) {
    return { reply: HELP_REPLY, action: null, source: "rule" };
  }

  if (isStopCommand(text)) {
    return { reply: "Baik, Bos. Saya berhenti bicara.", action: null, source: "rule" };
  }

  const convo = conversationReply(n, now);
  if (convo) return convo;

  const t = n.split(" ").filter(Boolean);
  const areaMatch = matchArea(n, options.areas, t);
  const kabMatch = matchOption(n, options.kabupaten);
  const kecMatch = matchOption(n, options.kecamatan);
  const brandMatch = matchOption(n, options.brands);
  const kategoriMatch = matchOption(n, options.kategori);

  // Pertanyaan angka dijawab dari data yang sudah termuat di dashboard.
  // Perintah bernavigasi (ada kata kerja) tetap membuka halaman + filter.
  const asksQuestion = t.some((w) => QUESTION_WORDS.has(w)) || text.includes("?");
  const wantsNavigation = t.some((w) => COMMAND_VERBS.includes(w));
  if (snapshot && asksQuestion && !wantsNavigation && !kabMatch && !kecMatch && !brandMatch) {
    const answered = answerFromSnapshot(n, snapshot);
    if (answered) return answered;
  }

  // kata yang tidak perlu ikut jadi kata kunci pencarian
  const drop = new Set<string>(STOPWORDS);
  for (const words of Object.values(PAGE_WORDS)) for (const w of words) drop.add(w);
  for (const phrase of [
    ...TRX_PHRASES.map(([p]) => p),
    ...ALASAN_PHRASES.map(([p]) => p),
    ...TREN_PHRASES.map(([p]) => p),
  ]) {
    for (const w of tokens(phrase)) drop.add(w);
  }
  for (const [w] of MONTH_WORDS) drop.add(w);
  for (const w of ["lalu", "kemarin", "sebelumnya", "ini", "depan", "ke", "yang"]) drop.add(w);
  for (const matched of [areaMatch, kabMatch, kecMatch, brandMatch, kategoriMatch]) {
    if (!matched) continue;
    for (const w of tokens(matched)) {
      drop.add(w);
      // buang juga kata pengguna yang mirip (salah ketik) supaya tidak jadi kata kunci
      for (const x of t) if (fuzzyEqual(x, w)) drop.add(x);
    }
  }
  // singkatan area yang dipakai ("smg", "jogja") jangan ikut jadi kata kunci
  if (areaMatch) {
    for (const [alias, area] of Object.entries(AREA_ALIAS)) {
      if (area !== areaMatch) continue;
      for (const x of t) if (x === alias || fuzzyEqual(x, alias)) drop.add(x);
    }
  }
  for (const w of [...ASC_WORDS, ...DESC_WORDS, ...SORT_VERBS, ...OMSET_WORDS]) drop.add(w);

  const residual = t.filter((w) => !drop.has(w) && w.length > 1 && !/^\d+$/.test(w)).join(" ").trim();
  const sort = detectDapSort(t);
  const searchVerb = t.some((w) => SEARCH_VERBS.includes(w));
  const hasVerb = t.some((w) => COMMAND_VERBS.includes(w));

  let page = detectPage(t);
  if (!page) {
    if (brandMatch) page = "produk";
    else if (kabMatch || kecMatch) page = "dap";
    else if (areaMatch) page = "bulanan";
    else if ((searchVerb || hasVerb) && (residual || DAP_METRICS.some(([w]) => t.includes(w)))) page = "dap";
  }

  // Tidak ada halaman/entitas yang bisa dipastikan -> akui tidak paham,
  // jangan membuka halaman acak atau mengarang data.
  if (!page) {
    return { reply: TIDAK_PAHAM, action: null, source: "rule" };
  }

  // Pertanyaan murni ("berapa ...") tetap diarahkan ke halaman yang relevan
  const params: Record<string, string> = {};

  if (page === "produk") {
    if (areaMatch) params.area = areaMatch;
    if (kategoriMatch) params.kategori = kategoriMatch;
    if (brandMatch) params.brand = brandMatch;
    const urut = matchProdukUrut(t);
    if (urut) params.urut = urut;
    if (residual) params.cari = residual;
  } else if (page === "dap") {
    if (areaMatch) params.area = areaMatch;

    // "di Semarang" cukup jadi filter area; baru pakai kabupaten bila disebut eksplisit
    const explicitKab = t.includes("kabupaten") || t.includes("kab");
    const explicitKec = t.includes("kecamatan") || t.includes("kec");
    if (kabMatch && (!areaMatch || kabMatch.toUpperCase() !== areaMatch || explicitKab)) {
      params.kab = kabMatch;
    }
    if (kecMatch && (!areaMatch || kecMatch.toUpperCase() !== areaMatch || explicitKec)) {
      params.kec = kecMatch;
    }

    const bulan = monthFromText(n, now);
    if (bulan !== null) params.bulan = String(bulan);

    const alasan = ALASAN_PHRASES.find(([phrase]) => containsPhrase(n, phrase))?.[1];
    const trx = TRX_PHRASES.find(([phrase]) => containsPhrase(n, phrase))?.[1];
    if (alasan) {
      params.trx = "TANPA";
      params.alasan = alasan;
    } else if (trx) {
      params.trx = trx;
    } else if (containsPhrase(n, "di atas target") || containsPhrase(n, "melampaui target") || containsPhrase(n, "surplus")) {
      params.trx = "AKTIF";
      if (!sort) { params.urut = "pcp"; params.arah = "desc"; }
    }

    // "penjualan turun" / "omset naik" -> filter tren + urut selisih terbesar
    const tren = TREN_PHRASES.find(([phrase]) => containsPhrase(n, phrase))?.[1];
    if (tren) {
      params.tren = tren;
      if (!sort) {
        params.urut = "selisih";
        params.arah = tren === "TURUN" ? "asc" : "desc";
      }
    } else if (!sort && !params.trx && !residual && t.some((w) => OMSET_WORDS.includes(w))) {
      // "buka omset" tanpa filter -> daftar toko urut omset terbesar
      params.urut = "omsetYtd";
      params.arah = "desc";
    }

    if (sort) {
      params.urut = sort.key;
      params.arah = sort.dir;
    }
    if (residual) params.q = residual;
  } else if (page === "mingguan") {
    if (areaMatch) params.area = areaMatch;
    const minggu = matchMinggu(t);
    if (minggu) params.minggu = minggu;
  } else if (page === "bulanan") {
    if (areaMatch) params.area = areaMatch;
  }

  const action: AsistenAction = { page, params };
  return { reply: describeAction(action), action, source: "rule" };
}

/** URL tujuan asisten (dipakai tombol klien). */
export function actionUrl(action: AsistenAction): string {
  const base = action.page === "beranda" ? "/" : `/${action.page}`;
  const qs = new URLSearchParams(action.params).toString();
  return qs ? `${base}?${qs}` : base;
}
