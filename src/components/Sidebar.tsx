"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { isDark, toggle } = useTheme();
  const [ubahPw, setUbahPw] = useState(false);
  const [hover, setHover] = useState(false);

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

  const btn =
    "group relative flex h-11 w-full items-center gap-3 rounded-2xl px-[0.8rem] text-slate-400 transition-colors duration-200 hover:text-sky-200";

  const Label = ({ children }: { children: React.ReactNode }) => (
    <AnimatePresence>
      {hover && (
        <motion.span
          initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.16 }}
          className="relative whitespace-nowrap text-[0.95rem] font-medium">
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* ===== Desktop / tablet: rel ikon di kiri ===== */}
      <motion.aside
        onHoverStart={() => setHover(true)} onHoverEnd={() => setHover(false)}
        onFocusCapture={() => setHover(true)} onBlurCapture={() => setHover(false)}
        animate={{ width: hover ? 232 : 76 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="glass-sidebar fixed bottom-4 left-4 top-4 z-50 hidden flex-col overflow-hidden rounded-[1.75rem] p-3 sm:flex"
        aria-label="Navigasi utama"
      >
        {/* Logo */}
        <Link href="/" title="Kembali ke Beranda"
          className="relative mb-4 flex h-12 shrink-0 items-center gap-3 rounded-2xl px-[0.35rem] outline-none">
          <span className="logo-orb flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-5 w-5">
              <line x1="5" y1="20" x2="5" y2="12.5" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="19" y1="20" x2="19" y2="10" />
            </svg>
          </span>
          <AnimatePresence>
            {hover && (
              <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.16 }} className="whitespace-nowrap leading-tight">
                <b className="block text-[1.05rem] tracking-tight">PCP</b>
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-sky-300/80">Dashboard</span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        <div className="mx-2 mb-3 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />

        {/* Menu utama */}
        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
          {items.map((t) => {
            const active = pathname === t.href;
            return (
              <Link key={t.key} href={t.href} title={t.label} aria-current={active ? "page" : undefined}
                className={`${btn} ${active ? "!text-sky-100" : ""}`}>
                {active && (
                  <motion.span layoutId="side-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="nav-active absolute inset-0 rounded-2xl" />
                )}
                {!active && (
                  <span className="absolute inset-0 rounded-2xl bg-sky-400/0 transition-colors duration-200 group-hover:bg-sky-400/10" />
                )}
                <span className="relative transition-transform duration-200 group-hover:scale-110"><Ico name={t.key} /></span>
                <Label>{t.label}</Label>
              </Link>
            );
          })}
        </nav>

        <div className="mx-2 my-3 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />

        {/* Aksi bawah */}
        <div className="flex flex-col gap-1.5">
          {me && (
            <button onClick={() => setUbahPw(true)} title={`Ubah password (ID: ${me.user.id})`} className={btn}>
              <span className="absolute inset-0 rounded-2xl bg-sky-400/0 transition-colors group-hover:bg-sky-400/10" />
              <span className="relative"><Ico name="kunci" /></span>
              <Label><span className="block max-w-32 truncate">{me.user.nama}</span></Label>
            </button>
          )}
          <button onClick={toggle} title="Ganti tema (tersimpan otomatis)" aria-pressed={!isDark} className={btn}>
            <span className="absolute inset-0 rounded-2xl bg-sky-400/0 transition-colors group-hover:bg-sky-400/10" />
            <span className="relative transition-transform duration-300 group-hover:rotate-12"><Ico name={isDark ? "matahari" : "bulan"} /></span>
            <Label>{isDark ? "Mode Terang" : "Mode Gelap"}</Label>
          </button>
          <button onClick={keluar} title="Keluar" className={`${btn} hover:!text-rose-300`}>
            <span className="absolute inset-0 rounded-2xl bg-rose-400/0 transition-colors group-hover:bg-rose-400/10" />
            <span className="relative"><Ico name="keluar" /></span>
            <Label>Keluar</Label>
          </button>
        </div>
      </motion.aside>

      {/* ===== Mobile: top bar (logo + aksi) ===== */}
      <header className="glass-sidebar fixed inset-x-3 z-50 flex h-14 items-center justify-between rounded-2xl px-3 sm:hidden"
        style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="Beranda">
          <span className="logo-orb flex h-9 w-9 items-center justify-center rounded-xl text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-[1.1rem] w-[1.1rem]">
              <line x1="5" y1="20" x2="5" y2="12.5" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="19" y1="20" x2="19" y2="10" />
            </svg>
          </span>
          <span className="leading-tight">
            <b className="block text-base tracking-tight">PCP</b>
            <span className="text-[0.62rem] uppercase tracking-[0.18em] text-sky-300/80">Dashboard</span>
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          {me && (
            <button onClick={() => setUbahPw(true)} aria-label={`Ubah password (${me.user.nama})`}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 active:bg-sky-400/10"><Ico name="kunci" /></button>
          )}
          <button onClick={toggle} aria-label="Ganti tema" aria-pressed={!isDark}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 active:bg-sky-400/10"><Ico name={isDark ? "matahari" : "bulan"} /></button>
          <button onClick={keluar} aria-label="Keluar"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 active:bg-rose-400/10 active:text-rose-300"><Ico name="keluar" /></button>
        </div>
      </header>

      {/* ===== Mobile: bar ikon menu di bawah ===== */}
      <nav aria-label="Navigasi utama"
        className="glass-sidebar fixed inset-x-3 z-50 flex items-center justify-around rounded-3xl p-1.5 sm:hidden"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {items.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.key} href={t.href} aria-label={t.label} aria-current={active ? "page" : undefined}
              className={`relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors ${active ? "text-sky-100" : "text-slate-400"}`}>
              {active && (
                <motion.span layoutId="side-pill-m" transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="nav-active absolute inset-0 rounded-2xl" />
              )}
              <span className="relative"><Ico name={t.key} className="h-[1.3rem] w-[1.3rem]" /></span>
              <span className="relative text-[0.58rem] font-medium leading-none">{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {ubahPw && <UbahPassword onClose={() => setUbahPw(false)} />}
    </>
  );
}
