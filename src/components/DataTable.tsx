"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  headerTitle?: string;
  cell: (row: T, index: number) => React.ReactNode;
  /** kalau diisi, kolom bisa diurut */
  sortValue?: (row: T) => number | string;
  align?: "left" | "right" | "center";
  /** lebar kolom (persen/px). Kalau ada minimal satu, tabel jadi table-fixed */
  width?: string;
  /** kolom angka: pakai tabular-nums supaya digit sejajar */
  numeric?: boolean;
}

export type Density = "compact" | "comfortable";

export default function DataTable<T>({
  columns, rows, rowKey, density = "comfortable", empty = "Tidak ada data",
  toolbar, toolbarRight, footer, rowClassName, onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  density?: Density;
  empty?: string;
  toolbar?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  footer?: React.ReactNode;
  rowClassName?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);

  const compact = density === "compact";
  const fixed = columns.some((c) => c.width);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "id") * dir;
    });
  }, [rows, columns, sortKey, dir]);

  const onSort = (k: string) => {
    if (sortKey === k) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setDir(1); }
  };

  const alignCls = (c: Column<T>) => (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left");
  const pad = compact ? "px-1.5 py-1.5" : "px-4 py-3";
  const thPad = compact ? "px-1.5 py-2" : "px-4 py-3";
  const clickable = onRowClick ? "cursor-pointer" : "";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04]">
      {(toolbar || toolbarRight) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs text-slate-400">
          <div className="min-w-0">{toolbar}</div>
          <div className="flex items-center gap-2">{toolbarRight}</div>
        </div>
      )}

      <div className="tbl-scroll">
        <table className={`w-full ${fixed ? "table-fixed" : ""} ${compact ? "text-[11px] leading-tight" : "text-sm"}`}>
          {fixed && (
            <colgroup>
              {columns.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            </colgroup>
          )}
          <thead className={`tbl-head border-b border-white/10 bg-white/5 text-slate-400 uppercase ${compact ? "text-[10px] tracking-wide" : "text-xs tracking-wider"}`}>
            <tr>
              {columns.map((c, i) => (
                <th key={c.key} scope="col" title={c.headerTitle}
                  className={`${thPad} ${alignCls(c)} whitespace-nowrap ${i === 0 ? "rounded-tl-2xl" : ""} ${i === columns.length - 1 ? "rounded-tr-2xl" : ""}`}>
                  {c.sortValue ? (
                    <button onClick={() => onSort(c.key)}
                      className={`inline-flex items-center gap-0.5 transition-colors hover:text-indigo-300 ${sortKey === c.key ? "text-indigo-300" : ""}`}>
                      {c.header}
                      <span className="text-[8px]">{sortKey === c.key ? (dir === 1 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">{empty}</td>
              </tr>
            )}
            {sorted.map((row, i) => {
              const cls = `${compact ? "" : "border-b border-white/5"} transition-colors hover:bg-white/5 ${clickable} ${rowClassName?.(row, i) ?? ""}`;
              const cells = columns.map((c) => (
                <td key={c.key} className={`${pad} ${alignCls(c)} ${c.numeric ? "tabular-nums" : ""}`}>
                  {c.cell(row, i)}
                </td>
              ));
              if (compact) {
                return (
                  <tr key={rowKey(row, i)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cls}>
                    {cells}
                  </tr>
                );
              }
              return (
                <motion.tr key={rowKey(row, i)} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.025 }} className={cls}>
                  {cells}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {footer}
    </div>
  );
}
