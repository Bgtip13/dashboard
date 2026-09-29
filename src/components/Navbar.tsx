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
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e1a]/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-3">
        {/* Logo = tombol ke Beranda */}
        <Link href="/" title="Kembali ke Beranda"
          className="mr-4 flex items-center gap-2 text-lg font-bold tracking-tight transition-opacity hover:opacity-75">
          <Icn e="📊" className="h-5 w-5 text-indigo-300" /> PCP Dashboard
        </Link>
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} className="relative rounded-full px-4 py-1.5 text-sm">
              {active && (
                <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-full bg-indigo-500/25 ring-1 ring-indigo-400/40" />
              )}
              <span className={`relative ${active ? "text-indigo-300" : "text-slate-400"}`}>{t.label}</span>
            </Link>
          );
        })}
        <button onClick={toggle} title="Ganti tema (tersimpan otomatis)"
          className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition-transform hover:scale-105 active:scale-95">
          <Icn e={isDark ? "☀️" : "🌙"} className="h-4 w-4" /> {isDark ? "Light" : "Dark"}
        </button>
      </div>
    </nav>
  );
}
