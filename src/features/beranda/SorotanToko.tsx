"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { rpShort } from "@/lib/utils";
import type { SorotanToko } from "@/lib/dapSegment";

type Mode = "bawah" | "kurang" | "turun";

const WARNA: Record<Mode, string> = {
  bawah: "text-slate-100",
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
      className="flex flex-col rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[1.05rem] font-medium">
            {title}
            <span className="chip-lime">{items.length}</span>
          </h3>
          <p className="mt-1 text-[0.78rem] leading-snug text-slate-500">{hint}</p>
        </div>
        <Link href={href} className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[0.78rem]">Lihat semua <span aria-hidden>→</span></Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-[var(--card-inner)] px-4 py-6 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {items.map((t, i) => {
            const b = baris(t, mode);
            return (
              <li key={`${t.toko}-${i}`}>
                <Link
                  href={`/dap?q=${encodeURIComponent(t.toko)}`}
                  title={`Buka ${t.toko} di DAP`}
                  className="flex items-center gap-3 rounded-2xl bg-[var(--card-inner)] px-3.5 py-2.5 transition-colors hover:bg-[var(--raised)] hover:shadow-[var(--raised-shadow)]"
                >
                  <span className="kbd w-6 shrink-0 text-center">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9rem] font-medium">{t.toko}</span>
                    <span className="mono block truncate text-[0.66rem] uppercase tracking-wide text-slate-500">
                      {t.area} · {t.kabupaten}{t.adm ? ` · ADM ${t.adm}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-[0.9rem] font-semibold tabular-nums ${warna}`}>{b.utama}</span>
                    <span className="mono block text-[0.66rem] tabular-nums text-slate-500">{b.sub}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mono mt-4 text-[0.64rem] uppercase tracking-[0.12em] text-slate-500">
        Top {items.length} · klik baris untuk buka di DAP
      </p>
    </motion.section>
  );
}
