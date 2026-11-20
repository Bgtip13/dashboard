"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/providers";
import UbahPassword from "./UbahPassword";
import { TAB_LIST } from "@/lib/tabs";
import { AuthError, fetchMe } from "@/lib/me";

/** Ikon garis (stroke) untuk tiap menu — konsisten dengan gaya Icn. */
const ICONS: Record<string, React.ReactNode> = {
  beranda: <path d="M3.5 11 12 3.8 20.5 11M5.5 9.6V20h13V9.6M10 20v-5.5h4V20" />,
  bulanan: (<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1.2" fill="currentColor" /></>),
  mingguan: (<><path d="M4 20V11M10 20V5M16 20v-7M21 20H3" /><path d="M4 7l5-3 5 4 6-4" /></>),
  dap: (<><path d="M4 9.5 5.6 4h12.8L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20" /></>),
  produk: (<><path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>),
  catatan: (<><path d="M6 3.5h9l4 4V20.5H6Z" /><path d="M15 3.5v4h4M9 12h7M9 15.5h7" /></>),
  pengguna: (<><circle cx="9" cy="8.5" r="3.4" /><path d="M2.8 20c0-3.6 2.8-6 6.2-6s6.2 2.4 6.2 6" /><path d="M16.5 5.4a3.2 3.2 0 0 1 0 6M18 14.2c2.2.6 3.4 2.6 3.4 5.8" /></>),
  kunci: (<><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3M16.5 6.5 19 9M13.5 9.5l2 2" /></>),
  matahari: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.8V5M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" /></>),
  bulan: <path d="M20 13.6A8.1 8.1 0 0 1 10.4 4 7.6 7.6 0 1 0 20 13.6Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  tutup: <path d="M15 5l-7 7 7 7" />,
  keluar: <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 8l-4 4 4 4M6 12h10" />,
};

function Ico({ name, className = "h-[1.35rem] w-[1.35rem]" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {ICONS[name]}
    </svg>
  );
}

interface Item { key: string; href: string; label: string }
type PanelState = "auto" | "open" | "closed";

const WIDE = "(min-width: 1280px)";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { isDark, toggle } = useTheme();
  const [ubahPw, setUbahPw] = useState(false);
  const [panel, setPanel] = useState<PanelState>("auto");
  const [cari, setCari] = useState("");

  // lebar area konten mengikuti panel (diatur lewat CSS variabel di <html>)
  useEffect(() => {
    document.documentElement.dataset.panel = panel;
    return () => { delete document.documentElement.dataset.panel; };
  }, [panel]);

  function togglePanel() {
    const efektif = panel === "auto" ? window.matchMedia(WIDE).matches : panel === "open";
    setPanel(efektif ? "closed" : "open");
  }

  // Dicek berkala (interval bawaan 30 dtk): user yang dihapus / password-nya diganti otomatis keluar
  const { data: me, error } = useQuery({ queryKey: ["me"], retry: false, queryFn: fetchMe });

  useEffect(() => {
    if (error instanceof AuthError && error.status === 401) {
      qc.clear();
      router.replace("/login");
    }
  }, [error, qc, router]);

  async function keluar() {
    await fetch("/api/auth/logout", { method: "POST" });
    qc.clear();
    router.replace("/login");
    router.refresh();
  }

  // Hanya tab yang diizinkan untuk akun ini (tunggu data akun dulu agar tab terlarang tidak sempat berkedip)
  const items: Item[] = me
    ? [
        { key: "beranda", href: "/", label: "Beranda" },
        ...TAB_LIST.filter((t) => me.user.tabs.includes(t.key)),
        ...(me.user.role === "admin" ? [{ key: "pengguna", href: "/pengguna", label: "Pengguna" }] : []),
      ]
    : [{ key: "beranda", href: "/", label: "Beranda" }];

  const q = cari.trim().toLowerCase();
  const tampil = q ? items.filter((t) => t.label.toLowerCase().includes(q)) : items;
  const inisial = (me?.user.nama ?? "PCP").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const panelCls = panel === "open" ? "flex" : panel === "closed" ? "hidden" : "hidden xl:flex";

  return (
    <>
      {/* ===== Desktop / tablet: rail gelap + panel terang ===== */}
      <aside className="fixed bottom-4 left-4 top-4 z-50 hidden gap-2 sm:flex" aria-label="Navigasi utama">
        {/* Rail */}
        <div className="flex w-[4.4rem] shrink-0 flex-col gap-2">
          <div className="rail flex flex-col items-center gap-1.5 rounded-[2.2rem] px-2 py-3">
            <Link href="/" title="Beranda" className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[1.45rem] w-[1.45rem]">
                <rect x="3.5" y="3.5" width="7" height="9" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.8" />
                <rect x="13.5" y="11.5" width="7" height="9" rx="1.8" /><rect x="3.5" y="15.5" width="7" height="5" rx="1.8" />
              </svg>
            </Link>
            {items.map((t) => {
              const active = pathname === t.href;
              return (
                <Link key={t.key} href={t.href} title={t.label} aria-label={t.label} aria-current={active ? "page" : undefined}
                  className="rail-btn relative flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Ico name={t.key} className="h-[1.2rem] w-[1.2rem]" />
                  {active && <span className="absolute -left-[0.55rem] h-2 w-1 rounded-full bg-[var(--lime)]" />}
                </Link>
              );
            })}
          </div>

          {/* Kapsul terang: ornamen vertikal */}
          <div className="side-panel relative flex min-h-0 flex-1 flex-col items-center justify-between overflow-hidden rounded-[2.2rem] py-4">
            <div className="flex h-24 items-end gap-[3px]" aria-hidden>
              {[5, 9, 14, 22, 30, 18, 12, 8, 6, 4].map((h, i) => (
                <span key={i} className="w-[2px] rounded-full" style={{ height: h, background: i === 4 ? "var(--lime-deep)" : "var(--ink)", opacity: i === 4 ? 1 : 0.35 }} />
              ))}
            </div>
            <p className="lbl whitespace-nowrap [writing-mode:vertical-rl] rotate-180">PCP · Dashboard</p>
          </div>

          <button type="button" onClick={togglePanel} aria-label="Buka atau tutup menu" title="Buka / tutup menu"
            className="rail mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform active:scale-95">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
              <path d="M6 9h12M6 15h12" />
            </svg>
          </button>
        </div>

        {/* Panel */}
        <div className={`side-panel ${panelCls} w-[16rem] shrink-0 flex-col rounded-[2.2rem] p-3`}>
          <div className="flex items-center gap-2.5 px-1 pb-3 pt-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-[0.95rem] bg-[#15161a] text-[0.95rem] font-semibold text-white dark:bg-[var(--lime)] dark:text-[#15161a]">P</span>
            <span className="min-w-0 leading-tight">
              <b className="block truncate text-[0.95rem] font-semibold">PCP Dashboard</b>
              <span className="text-[0.7rem] text-slate-400">Ruang kerja penjualan</span>
            </span>
          </div>

          <label className="relative mb-3 block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
              <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" />
            </svg>
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari menu"
              className="w-full rounded-2xl bg-[rgba(21,22,26,0.05)] py-2.5 pl-9 pr-3 text-[0.85rem] outline-none placeholder:text-slate-500" />
          </label>

          <p className="lbl mb-1.5 px-2">Menu</p>
          <nav className="flex flex-col gap-0.5 overflow-y-auto">
            {tampil.map((t) => {
              const active = pathname === t.href;
              return (
                <Link key={t.key} href={t.href} aria-current={active ? "page" : undefined}
                  className="side-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.9rem]">
                  <Ico name={t.key} className="h-[1.1rem] w-[1.1rem] opacity-80" />
                  <span className="flex-1">{t.label}</span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-deep)]" />}
                </Link>
              );
            })}
            {tampil.length === 0 && <p className="px-3 py-2 text-[0.8rem] text-slate-500">Menu tidak ditemukan.</p>}
          </nav>

          <p className="lbl mb-1.5 mt-5 px-2">Akun</p>
          <div className="flex flex-col gap-0.5">
            {me && (
              <button onClick={() => setUbahPw(true)} title={`Ubah password (ID: ${me.user.id})`}
                className="side-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[0.9rem]">
                <Ico name="kunci" className="h-[1.1rem] w-[1.1rem] opacity-80" /><span className="flex-1">Ubah password</span>
              </button>
            )}
            <button onClick={toggle} aria-pressed={!isDark} title="Ganti tema (tersimpan otomatis)"
              className="side-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[0.9rem]">
              <Ico name={isDark ? "matahari" : "bulan"} className="h-[1.1rem] w-[1.1rem] opacity-80" />
              <span className="flex-1">{isDark ? "Mode terang" : "Mode gelap"}</span>
            </button>
            <button onClick={keluar} title="Keluar"
              className="side-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[0.9rem]">
              <Ico name="keluar" className="h-[1.1rem] w-[1.1rem] opacity-80" /><span className="flex-1">Keluar</span>
            </button>
          </div>

          <div className="mt-auto flex items-center gap-2.5 rounded-2xl bg-[var(--raised)] px-3 py-2.5 shadow-[var(--raised-shadow)]">
            <span className="mono text-[0.72rem] font-semibold tracking-wider">{inisial}</span>
            <span className="min-w-0 leading-tight">
              <b className="block truncate text-[0.82rem] font-medium">{me?.user.nama ?? "…"}</b>
              <span className="text-[0.68rem] text-slate-400">{me?.user.role === "admin" ? "Akun utama" : "Pengguna"}</span>
            </span>
          </div>
        </div>
      </aside>

      {/* ===== Mobile: top bar (logo + aksi) ===== */}
      <header className="glass-sidebar fixed inset-x-3 z-50 flex h-14 items-center justify-between rounded-2xl px-3 sm:hidden"
        style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="Beranda">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15161a] text-sm font-semibold text-white dark:bg-[var(--lime)] dark:text-[#15161a]">P</span>
          <span className="leading-tight">
            <b className="block text-[0.95rem] font-semibold tracking-tight">PCP Dashboard</b>
            <span className="lbl !text-[0.58rem]">Ruang kerja</span>
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          {me && (
            <button onClick={() => setUbahPw(true)} aria-label={`Ubah password (${me.user.nama})`}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 active:bg-black/5"><Ico name="kunci" /></button>
          )}
          <button onClick={toggle} aria-label="Ganti tema" aria-pressed={!isDark}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 active:bg-black/5"><Ico name={isDark ? "matahari" : "bulan"} /></button>
          <button onClick={keluar} aria-label="Keluar"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 active:bg-black/5 active:text-rose-300"><Ico name="keluar" /></button>
        </div>
      </header>

      {/* ===== Mobile: bar ikon menu di bawah ===== */}
      <nav aria-label="Navigasi utama"
        className="rail fixed inset-x-3 z-50 flex items-center justify-around rounded-[1.8rem] p-1.5 sm:hidden"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {items.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.key} href={t.href} aria-label={t.label} aria-current={active ? "page" : undefined}
              className="rail-btn relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl">
              <Ico name={t.key} className="h-[1.2rem] w-[1.2rem]" />
              <span className="text-[0.56rem] font-medium leading-none">{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {ubahPw && <UbahPassword onClose={() => setUbahPw(false)} />}
    </>
  );
}
