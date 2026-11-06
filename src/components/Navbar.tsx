"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/app/providers";
import Icn from "./Icn";
import UbahPassword from "./UbahPassword";
import { TAB_LIST } from "@/lib/tabs";
import { AuthError, fetchMe } from "@/lib/me";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { isDark, toggle } = useTheme();
  const [ubahPw, setUbahPw] = useState(false);

  // Dicek berkala (interval bawaan 30 dtk): user yang dihapus / password-nya diganti otomatis keluar
  const { data: me, error } = useQuery({
    queryKey: ["me"],
    retry: false,
    queryFn: fetchMe,
  });

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

  // Hanya tab yang diizinkan untuk akun ini (menunggu data akun dulu supaya tab terlarang tidak sempat berkedip)
  const tabs = me
    ? [
        ...TAB_LIST.filter((t) => me.user.tabs.includes(t.key)),
        ...(me.user.role === "admin" ? [{ key: "pengguna", href: "/pengguna", label: "Pengguna" }] : []),
      ]
    : [];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[var(--nav-bg)] backdrop-blur">
      <div className="mx-auto flex max-w-[88rem] items-center gap-1 overflow-x-auto px-4 py-3.5 sm:px-8">
        {/* Logo = tombol ke Beranda */}
        <Link href="/" title="Kembali ke Beranda"
          className="mr-6 flex shrink-0 items-center gap-2.5 text-xl font-bold tracking-tight transition-opacity hover:opacity-75">
          <Icn e="📊" className="h-6 w-6 text-indigo-300" /> PCP Dashboard
        </Link>
        {tabs.map((t) => {
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
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {me && (
            <button onClick={() => setUbahPw(true)} title={`Ubah password (ID: ${me.user.id})`}
              className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-base text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100">
              <Icn e="🔑" className="h-5 w-5" />
              <span className="hidden max-w-32 truncate text-sm sm:inline">{me.user.nama}</span>
            </button>
          )}
          <button onClick={toggle} title="Ganti tema (tersimpan otomatis)" aria-pressed={!isDark}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-base transition-transform hover:scale-105 active:scale-95">
            <Icn e={isDark ? "☀️" : "🌙"} className="h-5 w-5" /> {isDark ? "Light" : "Dark"}
          </button>
          <button onClick={keluar} title="Keluar"
            className="rounded-full border border-white/10 px-4 py-2 text-base text-slate-300 transition-colors hover:bg-white/5 hover:text-rose-300">
            Keluar
          </button>
        </div>
      </div>
      {ubahPw && <UbahPassword onClose={() => setUbahPw(false)} />}
    </nav>
  );
}
