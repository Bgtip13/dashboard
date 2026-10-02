"use client";
import { motion } from "framer-motion";
import { getBadge, toArea } from "@/lib/badge";
import { rp } from "@/lib/utils";
import type { MonthlyRow } from "@/lib/types";
import Icn from "@/components/Icn";

export default function MonthlyTable({ rows }: { rows: MonthlyRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Jabatan</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Nama SDM</th>
              <th className="px-4 py-3 text-right">TGT</th>
              <th className="px-4 py-3 text-right">ACT</th>
              <th className="px-4 py-3 text-right">PCP%</th>
              <th className="px-4 py-3 text-right">Rp Kejar 100%</th>
              <th className="px-4 py-3">Badge</th>
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
                  <td className="px-4 py-3">{r.jabatan}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300">{r.area}</span></td>
                  <td className="px-4 py-3 font-medium">{r.nama}</td>
                  <td className="px-4 py-3 text-right">{rp(r.target)}</td>
                  <td className="px-4 py-3 text-right">{rp(r.aktual)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: b?.color ?? "#e2e8f0" }}>{p.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-slate-300">{rp(Math.max(r.target - r.aktual, 0))}</td>
                  <td className="px-4 py-3">
                    {b ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ color: b.color, background: b.bg + "55" }}>
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
