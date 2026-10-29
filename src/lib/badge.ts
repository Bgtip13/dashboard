export interface BadgeInfo { emoji: string; label: string; color: string; bg: string; }

/** Warna teks badge yang lebih gelap agar terbaca di atas latar terang */
const LIGHT_TONE: Record<string, string> = {
  "#facc15": "#a16207",
  "#f87171": "#b91c1c",
  "#fb923c": "#c2410c",
  "#60a5fa": "#1d4ed8",
  "#fbbf24": "#b45309",
  "#5eead4": "#0f766e",
  "#34d399": "#047857",
  "#94a3b8": "#475569",
};

/** Warna teks + latar badge yang aman untuk tema aktif */
export function badgeTone(badge: BadgeInfo, isDark: boolean) {
  if (isDark) return { color: badge.color, background: badge.bg + "99" };
  return { color: LIGHT_TONE[badge.color] ?? "#334155", background: badge.bg + "1f" };
}
export type Area = "SOLO" | "DIY" | "SEMARANG";

export const AREAS: readonly Area[] = ["SOLO", "DIY", "SEMARANG"];

/** Hari input per area (getDay(): 0=Minggu, 1=Senin, ...) */
const AREA_DAYS: Record<Area, number[]> = {
  SOLO: [1, 4],      // Senin & Kamis
  DIY: [2, 5],       // Selasa & Jumat
  SEMARANG: [3, 6],  // Rabu & Sabtu
};

/** Minimal slot lewat sebelum masuk penilaian performa (naikkan ke 4 kalau masih terlalu nois) */
const MIN_SLOTS = 3;

const MOTIVASI = {
  MULAI:   { emoji: "🌱", label: "Yuk Mulai!",     color: "#5eead4", bg: "#134e4a" },
  LANJUT:  { emoji: "✨", label: "Lanjutkan!",     color: "#facc15", bg: "#713f12" },
  KENCANG: { emoji: "🚀", label: "Start Kencang!", color: "#60a5fa", bg: "#1e3a8a" },
};

/** Urut dari yang paling perlu perhatian ke yang terbaik. */
const PERF: BadgeInfo[] = [
  { emoji: "⚠️", label: "Perlu Perhatian", color: "#f87171", bg: "#7f1d1d" },
  { emoji: "📉", label: "Perlu Dorongan",  color: "#fb923c", bg: "#7c2d12" },
  { emoji: "🎯", label: "On Pace",         color: "#facc15", bg: "#713f12" },
  { emoji: "🌟", label: "Di Atas Ritme",   color: "#60a5fa", bg: "#1e3a8a" },
  { emoji: "🏆", label: "Outstanding",     color: "#fbbf24", bg: "#78350f" },
];

const LEVEL_ON_PACE = 2;

/** Peringkat badge dari capaian absolut: <85, <90, <100 (sesuai ritme), <115, sisanya. */
function perfLevel(value: number): number {
  const v = Math.max(0, value);
  if (v < 85) return 0;
  if (v < 90) return 1;
  if (v < 100) return LEVEL_ON_PACE;
  if (v < 115) return 3;
  return 4;
}

/** Hitung berapa kemunculan weekday dari tanggal 1 s/d upToDay (inklusif) */
function countSlots(year: number, month: number, upToDay: number, weekdays: number[]): number {
  let n = 0;
  for (let d = 1; d <= upToDay; d++)
    if (weekdays.includes(new Date(year, month, d).getDay())) n++;
  return n;
}

export function getRhythm(pcp: number, area: Area, now = new Date()) {
  const { year, month, day } = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const wd           = AREA_DAYS[area];
  const totalSlots   = countSlots(year, month, daysInMonth, wd);
  const slotsPassed  = countSlots(year, month, day, wd); // includeToday = true (dashboard dilihat setelah input)
  const expected     = (slotsPassed / totalSlots) * 100;
  const score        = expected > 0 ? (pcp / expected) * 100 : null; // perkiraan akhir bulan
  return { pcp, slotsPassed, totalSlots, score };
}

function pickPerf(value: number): BadgeInfo {
  return PERF[perfLevel(value)];
}

function motivasiBadge(pcp: number, score: number | null, slots: number): BadgeInfo {
  if (pcp <= 0) return MOTIVASI.MULAI;
  if (score !== null && score >= 160 && slots >= 2) return MOTIVASI.KENCANG;
  return MOTIVASI.LANJUT;
}

/** Badge berbasis pcp absolut — untuk gauge agregat / area tak dikenal (tanpa logika ritme) */
export function getBadgeAbsolute(pcp: number): BadgeInfo {
  return pickPerf(pcp);
}

/**
 * area kosong/null → penilaian absolut.
 * Dengan area → ritme slot input ikut dinilai, tapi hanya boleh mengangkat badge
 * sampai "On Pace" selama PCP masih di bawah 100%. Pencapaian ≥ 100% dinilai
 * dari PCP-nya sendiri, supaya target yang lebih tinggi tidak pernah mendapat
 * badge yang lebih rendah daripada target yang belum tercapai.
 */
export function getBadge(pcp: number, area?: Area | null, now = new Date()): BadgeInfo {
  if (!area) return getBadgeAbsolute(pcp);

  const { score, slotsPassed } = getRhythm(pcp, area, now);
  if (score === null || slotsPassed < MIN_SLOTS) return motivasiBadge(pcp, score, slotsPassed);

  const level = pcp >= 100
    ? perfLevel(pcp)
    : Math.min(perfLevel(score), LEVEL_ON_PACE);
  return PERF[level];
}

/** Normalisasi string bebas → Area, null kalau tidak dikenal */
export function toArea(s: string): Area | null {
  const key = s.trim().toUpperCase();
  return (AREAS as readonly string[]).includes(key) ? (key as Area) : null;
}

/** Chip terpisah, muncul kapan pun pcp >= 100 */
export const isTargetAchieved = (pcp: number) => pcp >= 100;
