export interface BadgeInfo { emoji: string; label: string; color: string; bg: string; }
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

const PERF: [number, BadgeInfo][] = [
  [85,       { emoji: "⚠️", label: "Perlu Perhatian", color: "#f87171", bg: "#7f1d1d" }],
  [90,       { emoji: "📉", label: "Perlu Dorongan",  color: "#fb923c", bg: "#7c2d12" }],
  [105,      { emoji: "🎯", label: "On Pace",         color: "#facc15", bg: "#713f12" }],
  [115,      { emoji: "🌟", label: "Di Atas Ritme",   color: "#60a5fa", bg: "#1e3a8a" }],
  [Infinity, { emoji: "🏆", label: "Outstanding",     color: "#fbbf24", bg: "#78350f" }],
];

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

function pickPerf(score: number): BadgeInfo {
  const s = Math.max(0, score);
  for (const [max, b] of PERF) if (s < max) return b;
  return PERF[PERF.length - 1][1];
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

/** area kosong/null → fallback absolut; dengan area → penilaian berbasis ritme slot input */
export function getBadge(pcp: number, area?: Area | null, now = new Date()): BadgeInfo {
  if (!area) return getBadgeAbsolute(pcp);
  const { score, slotsPassed } = getRhythm(pcp, area, now);
  if (score === null || slotsPassed < MIN_SLOTS) return motivasiBadge(pcp, score, slotsPassed);
  return pickPerf(score);
}

/** Normalisasi string bebas → Area, null kalau tidak dikenal */
export function toArea(s: string): Area | null {
  const key = s.trim().toUpperCase();
  return (AREAS as readonly string[]).includes(key) ? (key as Area) : null;
}

/** Chip terpisah, muncul kapan pun pcp >= 100 */
export const isTargetAchieved = (pcp: number) => pcp >= 100;
