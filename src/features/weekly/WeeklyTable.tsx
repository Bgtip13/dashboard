"use client";
import { Fragment } from "react";
import { motion } from "framer-motion";
import { getBadge } from "@/lib/badge";
import { rp } from "@/lib/utils";
import type { WeeklyRow } from "@/lib/types";

const WEEK_LABELS = ["M1", "M2", "M3", "M4", "M5"];

export default function WeeklyTable({ rows, weekIdx }: { rows: WeeklyRow[]; weekIdx: number[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Jabatan</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Nama SDM</th>
              <th className="px-4 py-3 text-right">TGT/MGG</th>
              {weekIdx.flatMap((w) => [
                <th key={`a${w}`} className="px-4 py-3 text-right">ACT {WEEK_LABELS[w]}</th>,
                <th key={`p${w}`} className="px-4 py-3 text-right">{WEEK_LABELS[w]}%</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4 + weekIdx.length * 2} className="px-4 py-8 text-center text-slate-500">Tidak ada data</td></tr>
            )}
            {rows.map((r, i) => (
              <motion.tr key={r.area + r.nama} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }} className="border-b border-white/5 transition-colors hover:bg-white/5">
                <td className="px-4 py-3">{r.jabatan}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300">{r.area}</span></td>
                <td className="px-4 py-3 font-medium">{r.nama}</td>
                <td className="px-4 py-3 text-right">{rp(r.targetPerMinggu)}</td>
                {weekIdx.map((w) => {
                  const p = r.targetPerMinggu ? ((r.act[w] ?? 0) / r.targetPerMinggu) * 100 : 0;
                  const b = getBadge(p);
                  return (
                    <Fragment key={w}>
                      <td className="px-4 py-3 text-right">{rp(r.act[w] ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: b.color }}>{p.toFixed(0)}%</td>
                    </Fragment>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
