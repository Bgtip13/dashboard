"use client";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Grafik gaya "Runs today" pada video referensi: satu data, tiga tampilan.
 *  - dots  : matriks titik (default)
 *  - lines : garis ridge per seri
 *  - bars  : bar 3D lembut
 * Warna memakai variabel CSS (--ink, --lime, --danger) sehingga otomatis ikut tema terang/gelap.
 */
export interface MxSeries { name: string; values: number[]; color?: string }
export type MxView = "dots" | "lines" | "bars";

const PALETTE = ["var(--ink)", "#6f727d", "#a2a5af", "#c9ccd4", "#dfe1e6"];
const FUTURE = "color-mix(in srgb, var(--muted) 38%, transparent)";

const VIEW_ICON: Record<MxView, React.ReactNode> = {
  dots: <path d="M5 19v-3M9 19v-8M13 19v-5M17 19V7M21 19v-4" />,
  lines: <path d="M3 17c3 0 3-9 6-9s2 9 6 9 3-6 6-6" />,
  bars: <path d="M5 20v-6h4v6M10 20V8h4v12M15 20v-9h4v9" />,
};
const VIEW_LABEL: Record<MxView, string> = { dots: "Titik", lines: "Garis", bars: "Bar" };

/** Kurva halus lewat titik-titik (Catmull-Rom → bezier) */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function MatrixChart({
  categories, series, fmt, nowIndex, nowLabel = "NOW", stacked = false,
  height = 280, defaultView = "dots", views = ["dots", "lines", "bars"],
}: {
  categories: string[];
  series: MxSeries[];
  fmt: (v: number) => string;
  /** indeks kategori yang ditandai "NOW"; kategori sesudahnya dipudarkan */
  nowIndex?: number;
  nowLabel?: string;
  /** true: seri ditumpuk dalam satu kolom (mis. Aktual + Hilang) */
  stacked?: boolean;
  height?: number;
  defaultView?: MxView;
  views?: MxView[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [view, setView] = useState<MxView>(defaultView);
  const [hov, setHov] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = categories.length;
  const H = height;
  const L = view === "lines" ? Math.min(96, Math.max(64, w * 0.15)) : 6;
  const R = 8;
  const T = 34;
  const B = 24;
  const plotW = w - L - R;
  const plotH = H - T - B;
  const slotW = n ? plotW / n : plotW;
  const cx = (i: number) => L + slotW * (i + 0.5);
  const col = (k: number) => series[k]?.color ?? PALETTE[k % PALETTE.length];
  const isFuture = (i: number) => nowIndex !== undefined && i > nowIndex;

  const totals = categories.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0));
  const maxTotal = Math.max(1, ...(stacked ? totals : series.flatMap((s) => s.values)));
  const cols = stacked ? 1 : Math.max(1, series.length);
  const groupW = slotW * (cols > 1 ? 0.78 : 0.58);
  const colW = groupW / cols;

  // ----- Tampilan titik -----
  const d = Math.min(9, Math.max(3.5, colW / 1.5));
  const pitch = d * 1.32;
  const perRow = Math.max(1, Math.floor(colW / pitch));
  const capRows = Math.max(4, Math.floor(plotH / pitch));
  const unit = maxTotal / (perRow * capRows);

  const dotEls: React.ReactNode[] = [];
  if (view === "dots") {
    for (let i = 0; i < n; i++) {
      const gx = cx(i) - groupW / 2;
      let cum = 0;
      let prev = 0;
      for (let k = 0; k < series.length; k++) {
        const v = series[k].values[i] ?? 0;
        let from: number;
        let to: number;
        if (stacked) {
          cum += v;
          from = prev;
          to = Math.round(cum / unit);
          if (v > 0 && to === from) to = from + 1;
          prev = to;
        } else {
          from = 0;
          to = Math.round(v / unit);
          if (v > 0 && to === 0) to = 1;
        }
        const colX = stacked ? gx : gx + k * colW;
        const blockW = perRow * pitch;
        const x0 = colX + (colW - blockW) / 2 + pitch / 2;
        for (let j = from; j < to; j++) {
          // tumpukan beda seri dalam kolom yang sama mengisi baris, bukan kolom
          const row = Math.floor(j / perRow);
          const c = j % perRow;
          dotEls.push(
            <circle key={`${i}-${k}-${j}`} className="mx-dot" cx={x0 + c * pitch} cy={T + plotH - pitch * (row + 0.5)}
              r={d / 2} style={{ fill: isFuture(i) ? FUTURE : col(k), animationDelay: `${Math.min(i * 28 + row * 9, 900)}ms` }} />
          );
        }
      }
    }
  }

  // ----- Tampilan bar 3D -----
  const barEls: React.ReactNode[] = [];
  if (view === "bars") {
    const bw = Math.max(6, colW * 0.78);
    const dx = Math.min(7, bw * 0.4);
    const dy = dx * 0.6;
    for (let i = 0; i < n; i++) {
      const gx = cx(i) - groupW / 2;
      let accH = 0;
      for (let k = 0; k < series.length; k++) {
        const v = series[k].values[i] ?? 0;
        const h = (v / maxTotal) * (plotH - dy - 4);
        if (h <= 0) continue;
        const x = (stacked ? gx : gx + k * colW) + (colW - bw) / 2;
        const y = T + plotH - h - (stacked ? accH : 0);
        accH += stacked ? h : 0;
        const fill = isFuture(i) ? FUTURE : k === 0 ? `url(#g${uid})` : col(k);
        barEls.push(
          <g key={`${i}-${k}`} className="mx-dot" style={{ animationDelay: `${Math.min(i * 40, 700)}ms` }}>
            <polygon points={`${x + bw},${y} ${x + bw + dx},${y - dy} ${x + bw + dx},${y + h - dy} ${x + bw},${y + h}`}
              style={{ fill: "var(--ink)", opacity: 0.2 }} />
            <polygon points={`${x},${y} ${x + dx},${y - dy} ${x + bw + dx},${y - dy} ${x + bw},${y}`}
              style={{ fill: "#fff", opacity: 0.7 }} />
            <rect x={x} y={y} width={bw} height={h} rx={1.5} style={{ fill }} />
            <rect x={x} y={y} width={bw} height={h} rx={1.5}
              style={{ fill: "none", stroke: "var(--ink)", strokeOpacity: 0.16, strokeWidth: 1 }} />
          </g>
        );
      }
    }
  }

  // ----- Tampilan garis (ridge) -----
  const lineEls: React.ReactNode[] = [];
  if (view === "lines") {
    const rows = Math.max(1, series.length);
    const rowH = plotH / rows;
    series.forEach((s, k) => {
      const base = T + (k + 1) * rowH - 3;
      const mx = Math.max(1, ...s.values);
      const pts: [number, number][] = categories.map((_, i) => [cx(i), base - ((s.values[i] ?? 0) / mx) * (rowH - 8)]);
      const dLine = smooth(pts);
      const total = s.values.reduce((a, b) => a + b, 0);
      lineEls.push(
        <g key={s.name}>
          <line x1={L} x2={L + plotW} y1={base} y2={base} style={{ stroke: "var(--grid-line)", strokeWidth: 1 }} />
          <path d={`${dLine} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`} style={{ fill: "var(--ink)", opacity: 0.05 }} />
          <path d={dLine} className="mx-draw" pathLength={1} style={{ fill: "none", stroke: s.color ?? "var(--ink)", strokeWidth: 1.6, strokeLinejoin: "round", animationDelay: `${k * 80}ms` }} />
          <text x={L - 10} y={base - rowH * 0.32} textAnchor="end" style={{ fill: "var(--ink)", fontSize: 13, fontWeight: 600 }}>{s.name}</text>
          <text x={L - 10} y={base - rowH * 0.32 + 12} textAnchor="end" className="mono" style={{ fill: "var(--muted)", fontSize: 11, letterSpacing: "0.06em" }}>{fmt(total)}</text>
          {nowIndex !== undefined && nowIndex >= 0 && nowIndex < n && (
            <circle cx={pts[nowIndex][0]} cy={pts[nowIndex][1]} r={3.2} style={{ fill: "var(--lime)", stroke: "var(--ink)", strokeWidth: 1.2 }} />
          )}
        </g>
      );
    });
  }

  // ----- Chip tooltip / NOW -----
  const hovered = hov !== null && hov >= 0 && hov < n ? hov : null;
  const tipText = hovered === null ? "" : `${categories[hovered]} · ${series.map((s) => `${series.length > 1 ? `${s.name} ` : ""}${fmt(s.values[hovered] ?? 0)}`).join(" · ")}`;
  const tipW = tipText.length * 6.1 + 18;
  // sisakan ruang di kanan atas untuk tombol pengalih tampilan
  const maxRight = w - (views.length > 1 ? 108 : 2);
  const tipX = hovered === null ? 0 : Math.min(Math.max(cx(hovered) - tipW / 2, 2), Math.max(2, maxRight - tipW));
  const nowOk = nowIndex !== undefined && nowIndex >= 0 && nowIndex < n;
  const nowText = `${nowLabel} · ${nowOk ? categories[nowIndex as number] : ""}`;
  const nowW = nowText.length * 6.1 + 26;
  const nowX = nowOk ? Math.min(Math.max(cx(nowIndex as number) - nowW / 2, 2), Math.max(2, maxRight - nowW)) : 0;

  return (
    <div ref={wrap} className="relative w-full" style={{ height: H }}>
      {views.length > 1 && (
        <div className="seg absolute right-0 top-0 z-10" role="group" aria-label="Tampilan grafik">
          {views.map((v) => (
            <button key={v} type="button" aria-pressed={view === v} title={VIEW_LABEL[v]} aria-label={`Tampilan ${VIEW_LABEL[v]}`}
              onClick={() => setView(v)} className="!px-2 !py-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                {VIEW_ICON[v]}
              </svg>
            </button>
          ))}
        </div>
      )}
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label="Grafik" className="block overflow-visible">
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#c7cad2" />
          </linearGradient>
        </defs>

        {/* dasar & label sumbu */}
        <line x1={L} x2={L + plotW} y1={T + plotH + 3} y2={T + plotH + 3} style={{ stroke: "var(--grid-line)", strokeWidth: 1 }} />
        {categories.map((c, i) => (
          <text key={c + i} x={cx(i)} y={H - 6} textAnchor="middle" className="mono"
            style={{ fill: hovered === i || nowIndex === i ? "var(--ink)" : "var(--muted)", fontSize: 12, letterSpacing: "0.08em" }}>{c}</text>
        ))}

        {/* garis NOW */}
        {nowOk && (
          <g>
            <line x1={cx(nowIndex as number)} x2={cx(nowIndex as number)} y1={T - 4} y2={T + plotH + 3}
              style={{ stroke: "var(--ink)", strokeWidth: 1 }} />
            <circle cx={cx(nowIndex as number)} cy={T + plotH + 3} r={3.4} style={{ fill: "var(--lime)", stroke: "var(--ink)", strokeWidth: 1.2 }} />
          </g>
        )}

        <g key={`${view}-${n}-${series.length}`}>
          {view === "dots" && dotEls}
          {view === "bars" && barEls}
          {view === "lines" && lineEls}
        </g>

        {/* chip */}
        {hovered !== null ? (
          <g style={{ pointerEvents: "none" }}>
            <rect x={tipX} y={2} width={tipW} height={20} rx={10} style={{ fill: "var(--ink)" }} />
            <text x={tipX + tipW / 2} y={15.5} textAnchor="middle" className="mono" style={{ fill: "var(--app-bg)", fontSize: 11, fontWeight: 600 }}>{tipText}</text>
          </g>
        ) : nowOk ? (
          <g style={{ pointerEvents: "none" }}>
            <rect x={nowX} y={2} width={nowW} height={20} rx={10} style={{ fill: "var(--ink)" }} />
            <circle cx={nowX + 11} cy={12} r={3.2} style={{ fill: "var(--lime)" }} />
            <text x={nowX + 19} y={15.5} className="mono" style={{ fill: "var(--app-bg)", fontSize: 11, fontWeight: 600 }}>{nowText}</text>
          </g>
        ) : null}

        {/* area sentuh untuk hover per kategori */}
        {categories.map((c, i) => (
          <rect key={`h${c}${i}`} x={L + slotW * i} y={T - 4} width={slotW} height={plotH + 8} fill="transparent"
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onTouchStart={() => setHov(i)} />
        ))}
      </svg>
    </div>
  );
}
