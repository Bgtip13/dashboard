/**
 * Isi footer kartu: daftar label-nilai dengan tinggi minimum sama
 * supaya garis pemisah dan dasar kartu sejajar antar kartu.
 */
export default function StatRows({ rows, note, minHeight = 112 }: {
  rows: { label: string; value: React.ReactNode }[];
  note?: string;
  minHeight?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm" style={{ minHeight }}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-slate-400">{r.label}</span>
          <span className="truncate text-right font-semibold tabular-nums text-slate-200">{r.value}</span>
        </div>
      ))}
      {note && <p className="mt-auto pt-1 text-[0.75rem] leading-snug text-slate-500">{note}</p>}
    </div>
  );
}
