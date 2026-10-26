"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "@/app/providers";
import Icn from "./Icn";

const TABS = [
  { href: "/bulanan", label: "Bulanan" },
  { href: "/mingguan", label: "Mingguan" },
  { href: "/dap", label: "DAP" },
  { href: "/produk", label: "Produk" }, // ← TAMBAHAN BARU
];

export default function Navbar() {
  const pathname = usePathname();
  const { isDark, toggle } = useTheme();
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[var(--nav-bg)] backdrop-blur">
      <div className="mx-auto flex max-w-[88rem] items-center gap-1 overflow-x-auto px-4 py-3.5 sm:px-8">
        {/* Logo = tombol ke Beranda */}
        <Link href="/" title="Kembali ke Beranda"
          className="mr-6 flex shrink-0 items-center gap-2.5 text-xl font-bold tracking-tight transition-opacity hover:opacity-75">
          <Icn e="📊" className="h-6 w-6 text-indigo-300" /> PCP Dashboard
        </Link>
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} className="relative shrink-0 rounded-full px-5 py-2 text-base">
              {active && (
                <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-full bg-indigo-500/25 ring-1 ring-indigo-400/40" />
              )}
              <span className={`relative ${active ? "text-indigo-300" : "text-slate-400"}`}>{t.label}</span>
            </Link>
          );
        })}
        <button onClick={toggle} title="Ganti tema (tersimpan otomatis)" aria-pressed={!isDark}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-base transition-transform hover:scale-105 active:scale-95">
          <Icn e={isDark ? "☀️" : "🌙"} className="h-5 w-5" /> {isDark ? "Light" : "Dark"}
        </button>
      </div>
    </nav>
  );
}
