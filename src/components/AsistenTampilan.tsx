"use client";
import type { Tampilan } from "@/lib/bisnis/engine";

const fmt = (n: number, satuan: "rp" | "qty") => {
  const a = Math.abs(n);
  const s = satuan === "rp"
    ? a >= 1e9 ? `${(a / 1e9).toFixed(1)} M` : a >= 1e6 ? `${(a / 1e6).toFixed(1)} jt` : a >= 1e3 ? `${(a / 1e3).toFixed(0)} rb` : String(Math.round(a))
    : Math.round(a).toLocaleString("id-ID");
  return `${n < 0 ? "-" : ""}${s}`;
};

/** Grafik mini (bar/line) berbasis SVG — ringan, tanpa dependensi, aman di panel sempit. */
function Grafik({ g }: { g: NonNullable<Tampilan["grafik"]> }) {
  const W = 360, H = 130, padL = 6, padB = 22, padT = 8;
  const semua = g.seri.flatMap((s) => s.nilai);
  const max = Math.max(0, ...semua), min = Math.min(0, ...semua);
  const span = max - min || 1;
  const n = g.label.length;
  const y = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const x = (i: number) => padL + ((i + 0.5) / n) * (W - padL * 2);
  const warna = ["#818cf8", "#34d399"];
  const lebar = (W - padL * 2) / n;
  const bw = Math.max(4, Math.min(28, (lebar * 0.7) / g.seri.length));

  return (
    <figure className="mt-2">
      <figcaption className="mb-1 text-[0.7rem] font-medium text-slate-400">{g.judul}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={g.judul}>
        <line x1={padL} x2={W - padL} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.2} />
        {g.jenis === "bar"
          ? g.seri.map((s, si) => s.nilai.map((v, i) => {
              const top = Math.min(y(v), y(0)); const h = Math.abs(y(v) - y(0));
              return (
                <g key={`${si}-${i}`}>
                  <rect x={x(i) - (bw * g.seri.length) / 2 + si * bw} y={top} width={bw - 1} height={Math.max(1, h)} rx={2} fill={warna[si % 2]} opacity={0.85} />
                  {g.seri.length === 1 && n <= 8 && (
                    <text x={x(i)} y={top - 2} textAnchor="middle" fontSize="8" fill="currentColor" opacity={0.7}>{fmt(v, g.satuan)}</text>
                  )}
                </g>
              );
            }))
          : g.seri.map((s, si) => (
              <g key={si}>
                <polyline fill="none" stroke={warna[si % 2]} strokeWidth={2} points={s.nilai.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
                {s.nilai.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={warna[si % 2]}><title>{`${g.label[i]}: ${fmt(v, g.satuan)}`}</title></circle>)}
              </g>
            ))}
        {g.label.map((l, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="currentColor" opacity={0.6}>{n > 8 ? l.slice(0, 4) : l}</text>
        ))}
      </svg>
      {g.seri.length > 1 && (
        <div className="flex gap-3 text-[0.65rem] text-slate-400">
          {g.seri.map((s, i) => <span key={s.nama}><span style={{ color: warna[i % 2] }}>●</span> {s.nama}</span>)}
        </div>
      )}
    </figure>
  );
}

export default function AsistenTampilan({ t }: { t: Tampilan }) {
  return (
    <div className="mt-2 space-y-2">
      {t.tabel && (
        <div>
          <p className="mb-1 text-[0.7rem] font-medium text-slate-400">{t.tabel.judul}</p>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-max text-left text-[0.72rem]">
              <thead className="bg-white/[0.06] text-slate-300">
                <tr>{t.tabel.kolom.map((k) => <th key={k} className="whitespace-nowrap px-2 py-1.5 font-medium">{k}</th>)}</tr>
              </thead>
              <tbody>
                {t.tabel.baris.map((b, i) => (
                  <tr key={i} className="border-t border-white/5">
                    {b.map((c, j) => <td key={j} className={`px-2 py-1.5 ${j === b.length - 1 && b.length === 4 && t.tabel!.kolom[j] === "Alasan & bukti" ? "min-w-[220px] whitespace-normal" : "whitespace-nowrap"}`}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {t.grafik && <Grafik g={t.grafik} />}
    </div>
  );
}
