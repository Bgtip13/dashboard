"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]; // kolom pertama = Minggu
const LEBAR = 328;
const TINGGI_PANEL = 470;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`; // m: 1–12
const hariDalamBulan = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const hariPertama = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Minggu
const tambah = (t: string, n: number) => {
  const [y, m, d] = t.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const pendek = (t: string) => `${+t.slice(8)} ${BULAN[+t.slice(5, 7) - 1].slice(0, 3)} ${t.slice(0, 4)}`;
const hariIni = () => { const n = new Date(); return iso(n.getFullYear(), n.getMonth() + 1, n.getDate()); };

type Posisi = { left: number; top?: number; bottom?: number };

/**
 * Kalender pilih rentang tanggal: klik tanggal awal, lalu tanggal akhir.
 * Tanggal yang ada transaksinya diberi titik, yang kosong diredupkan, jadi tidak perlu menebak.
 * Panel dirender lewat portal (fixed) seperti SearchSelect supaya tidak tertimpa kartu lain.
 */
export default function DateRangePicker({ dari, sampai, onChange, max, adaData }: {
  dari: string; sampai: string;
  onChange: (dari: string, sampai: string) => void;
  max: string;                         // tanggal data paling akhir (acuan pintasan & bulan awal kalender)
  adaData: ReadonlySet<string>;        // tanggal yang punya transaksi
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Posisi | null>(null);
  const [awal, setAwal] = useState("");     // klik pertama (menunggu klik kedua)
  const [hover, setHover] = useState("");
  const [tahun, setTahun] = useState(0);
  const [bulan, setBulan] = useState(0);    // 1–12
  const root = useRef<HTMLDivElement | null>(null);
  const tombol = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  const today = hariIni();
  const acuan = max || today; // pintasan dihitung dari tanggal data terbaru

  const hitungPosisi = useCallback(() => {
    const el = tombol.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const lebar = Math.min(LEBAR, vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - lebar - 8));
    if (vh - r.bottom - 12 < TINGGI_PANEL && r.top - 12 > vh - r.bottom - 12) setPos({ left, bottom: vh - r.top + 8 });
    else setPos({ left, top: r.bottom + 8 });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    hitungPosisi();
    window.addEventListener("resize", hitungPosisi);
    window.addEventListener("scroll", hitungPosisi, true);
    return () => {
      window.removeEventListener("resize", hitungPosisi);
      window.removeEventListener("scroll", hitungPosisi, true);
    };
  }, [open, hitungPosisi]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (root.current?.contains(t) || panel.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function buka() {
    const t = dari || sampai || acuan;
    setTahun(+t.slice(0, 4));
    setBulan(+t.slice(5, 7));
    setAwal("");
    setHover("");
    setOpen(true);
  }

  function geser(n: number) {
    const idx = tahun * 12 + (bulan - 1) + n;
    setTahun(Math.floor(idx / 12));
    setBulan((idx % 12) + 1);
  }

  function terapkan(a: string, b: string) {
    onChange(a, b);
    setAwal("");
    setOpen(false);
    tombol.current?.focus();
  }

  function klik(t: string) {
    if (!awal) { setAwal(t); return; }
    terapkan(t < awal ? t : awal, t < awal ? awal : t);
  }

  // Pintasan, dihitung dari tanggal data terbaru
  const pintasan = useMemo(() => {
    const y = +acuan.slice(0, 4), m = +acuan.slice(5, 7);
    const mp = m === 1 ? 12 : m - 1, yp = m === 1 ? y - 1 : y;
    return [
      { label: "7 hari terakhir", a: tambah(acuan, -6), b: acuan },
      { label: "30 hari terakhir", a: tambah(acuan, -29), b: acuan },
      { label: BULAN[m - 1] + " " + y, a: iso(y, m, 1), b: acuan },
      { label: BULAN[mp - 1] + " " + yp, a: iso(yp, mp, 1), b: iso(yp, mp, hariDalamBulan(yp, mp)) },
    ];
  }, [acuan]);

  // Sel kalender bulan yang tampil
  const sel = useMemo(() => {
    if (!tahun) return [];
    const kosong = hariPertama(tahun, bulan);
    const n = hariDalamBulan(tahun, bulan);
    return [...Array<null>(kosong).fill(null), ...Array.from({ length: n }, (_, i) => iso(tahun, bulan, i + 1))];
  }, [tahun, bulan]);

  // Rentang yang sedang disorot: pilihan sementara (awal → hover) atau rentang yang sudah dipakai
  const [ra, rb] = useMemo(() => {
    if (awal) { const h = hover || awal; return awal <= h ? [awal, h] : [h, awal]; }
    return [dari, sampai || dari];
  }, [awal, hover, dari, sampai]);

  const aktif = Boolean(dari || sampai);
  const teks = aktif
    ? `${dari ? pendek(dari) : "…"} – ${sampai ? pendek(sampai) : "…"}`
    : "Semua tanggal";

  return (
    <div ref={root} className="relative flex w-full items-center gap-2">
      <button ref={tombol} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label="Pilih rentang tanggal"
        onClick={() => (open ? setOpen(false) : buka())}
        className={`flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-4 text-base outline-none transition-colors hover:border-white/20 focus:border-indigo-400/60 ${aktif ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-200" : "border-white/10 bg-white/5 text-slate-200"}`}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
        <span className="flex-1 truncate text-left">{teks}</span>
        <span aria-hidden className={`text-xs text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {aktif && (
        <button type="button" aria-label="Hapus filter tanggal" title="Hapus filter tanggal" onClick={() => onChange("", "")}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200">✕</button>
      )}

      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={panel} role="dialog" aria-label="Kalender rentang tanggal"
          className="pop-panel fixed z-[200] overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: Math.min(LEBAR, window.innerWidth - 16) }}>
          {/* Pintasan */}
          <div className="flex flex-wrap gap-1.5 border-b border-white/10 p-3">
            {pintasan.map((p) => (
              <button key={p.label} type="button" onClick={() => terapkan(p.a, p.b)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-indigo-500/20 hover:text-indigo-200">
                {p.label}
              </button>
            ))}
          </div>

          <div className="p-3">
            {/* Navigasi bulan */}
            <div className="mb-2 flex items-center justify-between">
              <button type="button" aria-label="Bulan sebelumnya" onClick={() => geser(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10">◀</button>
              <span className="text-base font-semibold text-slate-100">{BULAN[bulan - 1]} {tahun}</span>
              <button type="button" aria-label="Bulan berikutnya" onClick={() => geser(1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10">▶</button>
            </div>

            {/* Nama hari */}
            <div className="grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
              {HARI.map((h, i) => <span key={h} className={`py-1.5 ${i === 0 ? "text-rose-400/80" : ""}`}>{h}</span>)}
            </div>

            {/* Tanggal */}
            <div className="grid grid-cols-7" onMouseLeave={() => setHover("")}>
              {sel.map((t, i) => {
                if (!t) return <span key={`k${i}`} />;
                const mulai = t === ra, akhir = t === rb;
                const dalam = Boolean(ra && rb) && t >= ra && t <= rb;
                const ujung = mulai || akhir;
                const ada = adaData.has(t);
                const col = i % 7;
                return (
                  <div key={t}
                    className={`relative flex h-10 items-center justify-center ${dalam ? "bg-indigo-500/20" : ""} ${mulai || col === 0 ? "rounded-l-full" : ""} ${akhir || col === 6 ? "rounded-r-full" : ""}`}>
                    <button type="button" onClick={() => klik(t)} onMouseEnter={() => awal && setHover(t)}
                      aria-label={pendek(t)} aria-pressed={ujung}
                      className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors
                        ${ujung ? "bg-indigo-500 font-semibold text-white shadow-md shadow-indigo-500/30" : ada ? "text-slate-100 hover:bg-white/15" : "text-slate-500 hover:bg-white/10"}
                        ${t === today && !ujung ? "ring-1 ring-cyan-400/70" : ""}`}>
                      {+t.slice(8)}
                      {ada && (
                        <span aria-hidden className={`absolute bottom-0.5 h-1 w-1 rounded-full ${ujung ? "bg-white" : "bg-emerald-400"}`} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Petunjuk & status */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2.5 text-xs">
            <span className="text-slate-400">
              {awal
                ? <>Mulai <b className="text-indigo-300">{pendek(awal)}</b> — pilih tanggal akhir</>
                : <>Klik tanggal <b className="text-slate-200">awal</b>, lalu tanggal <b className="text-slate-200">akhir</b></>}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-slate-500">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ada transaksi
            </span>
          </div>
          {(aktif || awal) && (
            <div className="flex justify-end gap-2 border-t border-white/10 px-3 py-2.5">
              {awal && (
                <button type="button" onClick={() => terapkan(awal, awal)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/10">Hanya {pendek(awal)}</button>
              )}
              <button type="button" onClick={() => terapkan("", "")}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/10">Reset</button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
