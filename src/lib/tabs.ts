/** Daftar tab yang bisa diatur aksesnya per akun (aman dipakai di server maupun klien). */
export interface TabDef { key: string; href: string; label: string }

export const TAB_LIST: readonly TabDef[] = [
  { key: "bulanan", href: "/bulanan", label: "Bulanan" },
  { key: "mingguan", href: "/mingguan", label: "Mingguan" },
  { key: "dap", href: "/dap", label: "DAP" },
  { key: "produk", href: "/produk", label: "Produk" },
  { key: "catatan", href: "/catatan", label: "Catatan" },
];

export const ALL_TAB_KEYS: readonly string[] = TAB_LIST.map((t) => t.key);

/**
 * Tab yang boleh dibuka sebuah akun.
 * - akun utama (admin): selalu semua tab
 * - `tabs` kosong/null (akun lama sebelum fitur ini ada): semua tab, supaya tidak ada yang tiba-tiba terkunci
 */
export function resolveTabs(role: "admin" | "user", tabs: unknown): string[] {
  if (role === "admin" || !Array.isArray(tabs)) return [...ALL_TAB_KEYS];
  return ALL_TAB_KEYS.filter((k) => tabs.includes(k));
}
