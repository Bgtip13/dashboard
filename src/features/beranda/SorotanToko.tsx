"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { rpShort } from "@/lib/utils";
import type { SorotanToko } from "@/lib/dapSegment";

type Mode = "bawah" | "kurang" | "turun";

const WARNA: Record<Mode, string> = {
  bawah: "text-amber-300",
  kurang: "text-rose-300",
  turun: "text-rose-300",
};

/** Angka utama + keterangan kecil per baris sorotan. */
function baris(t: SorotanToko, mode: Mode): { utama: string; sub: string } {
  if (mode === "turun") {
    return {
      utama: `−${rpShort(Math.abs(t.selisih))}`,
      sub: `${rpShort(t.sebelumnya)} → ${rpShort(t.aktual)}`,
    };
  }
  if (mode === "kurang") {
    return {
      utama: `target ${rpShort(t.target)}`,
      sub: `realisasi ${rpShort(t.aktual)} · ${t.pcp.toFixed(0)}%`,
    };
  }
  return {
    utama: `kurang ${rpShort(t.gap)}`,
    sub: `aktual ${rpShort(t.aktual)} · ${t.pcp.toFixed(0)}%`,
  };
}

/** Daftar pendek toko untuk sorotan beranda — tiap baris membuka tokonya di DAP. */
export default function SorotanTokoList({
  title, hint, items, mode, href, empty,
}: {
  title: string;
  hint: string;
  items: SorotanToko[];
  mode: Mode;
  href: string;
  empty: string;
}) {
  const warna = WARNA[mode];
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-wider text-slate-400">{title}</p>
          <p className="mt-0.5 text-[0.8rem] leading-snug text-slate-500">{hint}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[0.75rem] text-slate-300">
          {items.length} toko
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="mt-2 divide-y divide-white/5">
          {items.map((t, i) => {
            const b = baris(t, mode);
            return (
              <li key={`${t.toko}-${i}`}>
                <Link
                  href={`/dap?q=${encodeURIComponent(t.toko)}`}
                  title={`Buka ${t.toko} di DAP`}
                  className="flex items-center gap-2.5 py-2 transition-colors hover:bg-white/5"
                >
                  <span className="w-4 shrink-0 text-right text-[0.75rem] tabular-nums text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">{t.toko}</span>
                    <span className="block truncate text-[0.75rem] text-slate-500">
                      {t.area} · {t.kabupaten}{t.adm ? ` · ADM ${t.adm}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-sm font-bold tabular-nums ${warna}`}>{b.utama}</span>
                    <span className="block text-[0.75rem] tabular-nums text-slate-500">{b.sub}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-300 hover:text-indigo-200">
        Lihat semua di DAP →
      </Link>
    </motion.section>
  );
}
