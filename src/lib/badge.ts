export interface BadgeInfo { emoji: string; label: string; color: string; bg: string; }

const RULES: [number, BadgeInfo][] = [
  [75, { emoji: "⚠️", label: "Perlu Perhatian", color: "#f87171", bg: "#7f1d1d" }],
  [85, { emoji: "📉", label: "Perlu Dorongan", color: "#fb923c", bg: "#7c2d12" }],
  [91, { emoji: "🎯", label: "On Track", color: "#facc15", bg: "#713f12" }],
  [100, { emoji: "✅", label: "Target Tercapai", color: "#4ade80", bg: "#14532d" }],
  [110, { emoji: "🌟", label: "High Performer", color: "#60a5fa", bg: "#1e3a8a" }],
  [Infinity, { emoji: "🏆", label: "Outstanding", color: "#fbbf24", bg: "#78350f" }],
];

export function getBadge(pcp: number): BadgeInfo {
  for (const [max, b] of RULES) if (pcp < max) return b;
  return RULES[RULES.length - 1][1];
}

