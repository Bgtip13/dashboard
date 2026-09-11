"use client";
import { useMemo, useState } from "react";
import type { DapRow } from "@/lib/types";
import { rpShort } from "@/lib/utils";
import { MONTH_SHORT } from "./DapChart";

const PAGE = 25;

type Enriched = DapRow & { aktual: number; kontrib: number; avg: number; pcp: number };

function statusColor(s: string) {
  const n = s.toUpperCase();
  if (n.includes("LANCAR")) return { color: "#4ade80", bg: "#14532d" };
  if (n.includes("PASIF") || n.includes("DO NOT")) return { color: "#f87171", bg: "#7f1d1d" };
  if (n.includes("BARU") || n.includes("GANTI")) return { color: "#60a5fa", bg: "#1e3a8a" };
  return { color: "#94a3b8", bg: "#1e293b" };
}

function Th({ k, sortKey, dir, onSort, children, right = false }: {
  k: string; sortKey: string | null; dir: 1 | -1; onSort: (k: string) => void;
  children: React.ReactNode; right?: boolean;
}) {
  const active = sortKey === k;
  return (
    <th className={`px-1 py-2 ${right ? "text-right" : "text-left"}`}>
      <button onClick={() => onSort(k)}
        className={`inline-flex items-center gap-0.5 uppercase transition-colors hover:text-indigo-300 ${active ? "text-indigo-300" : ""}`}>
        {children}
        <span className="text-[8px]">{active ? (dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

export default function DapTable({
  rows, monthIdx, totalOmset, onSelect, selectedToko,
}: {
  rows: DapRow[]; monthIdx: number; totalOmset: number;
  onSelect?: (r: DapRow) => void; selectedToko?: string | null;
}) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);

  const enriched: Enriched[] = useMemo(() => rows.map((r) => {
    const aktual = r.bulanan[monthIdx] ?? 0;
    const aktifBulan = r.bulanan.filter((v) => v > 0).length || 1;
    return {
      ...r, aktual,
      kontrib: totalOmset ? (r.omsetYtd / totalOmset) * 100 : 0,
      avg: r.omsetYtd / aktifBulan,
      pcp: r.targetToko ? (aktual / r.targetToko) * 100 : 0,
    };
  }), [rows, monthIdx, totalOmset]);

  const sorted = useMemo(() => {
    if (!sortKey) return enriched;
    return [...enriched].sort((a, b) => {
      const va = (a as unknown as Record<string, unknown>)[sortKey];
      const vb = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? ""), "id") * dir;
    });
  }, [enriched, sortKey, dir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const p = Math.min(page, pageCount - 1);
  const view = sorted.slice(p * PAGE, p * PAGE + PAGE);

  const onSort = (k: string) => {
    if (sortKey === k) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setDir(1); }
    setPage(0);
  };

  const td = "truncate px-1.5 py-1.5";
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-slate-400">
        <span>
          <b className="text-slate-200">{view.length}</b> dari <b className="text-slate-200">{sorted.length}</b> toko
          {sortKey && <> · urut <b className="text-indigo-300">{sortKey} {dir === 1 ? "▲" : "▼"}</b></>}
          <span className="ml-2 hidden text-slate-500 lg:inline">· klik nama toko = grafiknya</span>
        </span>
        <div className="flex items-center gap-2">
          <button disabled={p === 0} onClick={() => setPage(p - 1)}
            className="rounded-lg border border-white/10 px-2 py-1 disabled:opacity-30 hover:bg-white/5">◀ Prev</button>
          <span>Hal {p + 1}/{pageCount}</span>
          <button disabled={p >= pageCount - 1} onClick={() => setPage(p + 1)}
            className="rounded-lg border border-white/10 px-2 py-1 disabled:opacity-30 hover:bg-white/5">Next ▶</button>
        </div>
      </div>
      <table className="w-full table-fixed text-[11px] leading-tight">
        <colgroup>
          <col style={{ width: "3%" }} /><col style={{ width: "5%" }} /><col style={{ width: "7%" }} />
          <col style={{ width: "9%" }} /><col style={{ width: "14%" }} /><col style={{ width: "4.5%" }} />
          <col style={{ width: "5.5%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} />
          <col style={{ width: "5%" }} /><col style={{ width: "8%" }} /><col style={{ width: "4%" }} />
          <col style={{ width: "7%" }} /><col style={{ width: "6.5%" }} /><col style={{ width: "5.5%" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-[10px] text-slate-400">
            <th className="px-1 py-2 text-left">NO</th>
            <Th k="area" sortKey={sortKey} dir={dir} onSort={onSort}>Area</Th>
            <Th k="kabupaten" sortKey={sortKey} dir={dir} onSort={onSort}>Kab.</Th>
            <Th k="kecamatan" sortKey={sortKey} dir={dir} onSort={onSort}>Kec.</Th>
            <Th k="toko" sortKey={sortKey} dir={dir} onSort={onSort}>Toko</Th>
            <Th k="adm" sortKey={sortKey} dir={dir} onSort={onSort}>ADM</Th>
            <Th k="kelasToko" sortKey={sortKey} dir={dir} onSort={onSort}>Kelas</Th>
            <Th k="aktual" sortKey={sortKey} dir={dir} onSort={onSort} right>Akt {MONTH_SHORT[monthIdx]}</Th>
            <Th k="omsetYtd" sortKey={sortKey} dir={dir} onSort={onSort} right>Omset YTD</Th>
            <Th k="kontrib" sortKey={sortKey} dir={dir} onSort={onSort} right>Kontr%</Th>
            <Th k="avg" sortKey={sortKey} dir={dir} onSort={onSort} right>Avg</Th>
            <Th k="bulanPasif" sortKey={sortKey} dir={dir} onSort={onSort}>Pasif</Th>
            <Th k="targetToko" sortKey={sortKey} dir={dir} onSort={onSort} right>Target</Th>
            <Th k="status" sortKey={sortKey} dir={dir} onSort={onSort}>Status</Th>
            <Th k="pcp" sortKey={sortKey} dir={dir} onSort={onSort} right>PCP%</Th>
          </tr>
        </thead>
        <tbody>
          {view.length === 0 && (
            <tr><td colSpan={15} className="px-4 py-8 text-center text-slate-500">Tidak ada toko yang cocok dengan filter</td></tr>
          )}
          {view.map((r, i) => {
            const sc = statusColor(r.status);
            const isSel = selectedToko === r.toko;
            return (
              <tr key={r.toko + i}
                className={`border-b border-white/5 transition-colors hover:bg-white/5 ${isSel ? "bg-indigo-500/10" : ""}`}>
                <td className={`${td} text-slate-500`}>{p * PAGE + i + 1}</td>
                <td className={`${td} font-medium text-indigo-300`} title={r.area}>{r.area}</td>
                <td className={td} title={r.kabupaten}>{r.kabupaten}</td>
                <td className={td} title={r.kecamatan}>{r.kecamatan}</td>
                <td className="px-1.5 py-1.5">
                  <button onClick={() => onSelect?.(r)} title={`${r.toko} — klik untuk grafik`}
                    className={`block w-full truncate text-left font-medium hover:text-indigo-300 hover:underline ${isSel ? "text-indigo-300" : "text-slate-100"}`}>
                    {r.toko}
                  </button>
                </td>
                <td className={td} title={r.adm}>{r.adm}</td>
                <td className={td} title={`${r.kelasToko} / ${r.kelasByr}`}>{r.kelasToko}{r.kelasByr ? `/${r.kelasByr}` : ""}</td>
                <td className={`${td} text-right`}>{rpShort(r.aktual)}</td>
                <td className={`${td} text-right`}>{rpShort(r.omsetYtd)}</td>
                <td className={`${td} text-right text-slate-300`}>{r.kontrib.toFixed(2)}%</td>
                <td className={`${td} text-right text-slate-300`}>{rpShort(r.avg)}</td>
                <td className={`${td} text-slate-400`}>{r.bulanPasif}</td>
                <td className={`${td} text-right`}>{rpShort(r.targetToko)}</td>
                <td className="px-1 py-1.5">
                  <span className="block truncate rounded-full px-1 py-0.5 text-center text-[10px]" style={{ color: sc.color, background: sc.bg + "66" }} title={r.status}>
                    {r.status}
                  </span>
                </td>
                <td className={`${td} text-right font-bold`} style={{ color: r.pcp >= 100 ? "#4ade80" : r.pcp >= 85 ? "#facc15" : r.pcp > 0 ? "#fb923c" : "#64748b" }}>
                  {r.pcp > 0 ? `${r.pcp.toFixed(0)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
