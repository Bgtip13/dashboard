"use client";
import { motion } from "framer-motion";
import { badgeTone, getBadge, toArea } from "@/lib/badge";
import { useTheme } from "@/app/providers";
import { rp } from "@/lib/utils";
import type { MonthlyRow } from "@/lib/types";
import Icn from "@/components/Icn";

export default function MonthlyTable({ rows }: { rows: MonthlyRow[] }) {
  const { isDark } = useTheme();
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left text-sm uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3.5">Jabatan</th>
              <th className="px-5 py-3.5">Area</th>
              <th className="px-5 py-3.5">Nama SDM</th>
              <th className="px-5 py-3.5 text-right">TGT</th>
              <th className="px-5 py-3.5 text-right">ACT</th>
              <th className="px-5 py-3.5 text-right">PCP%</th>
              <th className="px-5 py-3.5 text-right">Rp Kejar 100%</th>
              <th className="px-5 py-3.5">Badge</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Tidak ada data</td></tr>
            )}
            {rows.map((r, i) => {
              const p = r.target ? (r.aktual / r.target) * 100 : 0;
              const area = toArea(r.area);
              const b = area ? getBadge(p, area) : null;
              return (
                <motion.tr key={r.area + r.nama} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }} className="border-b border-white/5 transition-colors hover:bg-white/5">
                  <td className="px-5 py-3.5">{r.jabatan}</td>
                  <td className="px-5 py-3.5"><span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-sm text-indigo-300">{r.area}</span></td>
                  <td className="px-5 py-3.5 font-medium">{r.nama}</td>
                  <td className="px-5 py-3.5 text-right">{rp(r.target)}</td>
                  <td className="px-5 py-3.5 text-right">{rp(r.aktual)}</td>
                  <td className="px-5 py-3.5 text-right font-bold"
                    style={{ color: b ? badgeTone(b, isDark).color : "var(--app-fg)" }}>{p.toFixed(1)}%</td>
                  <td className="px-5 py-3.5 text-right text-slate-300">{rp(Math.max(r.target - r.aktual, 0))}</td>
                  <td className="px-5 py-3.5">
                    {b ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
                        style={badgeTone(b, isDark)}>
                        <Icn e={b.emoji} className="h-3 w-3" /> {b.label}
                      </span>
                    ) : "—"}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
