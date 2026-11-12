"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SearchItem { value: string; label: string }

const MAX_TAMPIL = 150; // daftar sangat panjang (mis. ratusan toko) cukup dirender sebagian, sisanya lewat pencarian
const LEBAR = 288;      // lebar panel dropdown (px)
const TINGGI_PANEL = 380;

type Posisi = { left: number; top?: number; bottom?: number; maxList: number };

/**
 * Pengganti <select> dengan kotak cari di dalamnya.
 * Panel dirender lewat portal ke <body> (position: fixed, latar solid) supaya tidak pernah
 * tertimpa/tembus kartu lain di bawahnya, apa pun stacking context induknya.
 */
export default function SearchSelect({ value, onChange, items, placeholder = "Cari…", ariaLabel, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  items: readonly SearchItem[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [aktif, setAktif] = useState(0);
  const [pos, setPos] = useState<Posisi | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const tombol = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const aktifEl = useRef<HTMLLIElement | null>(null);

  const terpilih = items.find((i) => i.value === value);

  const hasil = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return items;
    return items.filter((i) => {
      const l = i.label.toLowerCase();
      return terms.every((t) => l.includes(t));
    });
  }, [items, q]);
  const tampil = hasil.slice(0, MAX_TAMPIL);

  /** Hitung posisi panel dari tombol; buka ke atas bila ruang di bawah tidak cukup. */
  const hitungPosisi = useCallback(() => {
    const el = tombol.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const lebar = Math.min(LEBAR, vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - lebar - 8));
    const ruangBawah = vh - r.bottom - 12;
    const ruangAtas = r.top - 12;
    if (ruangBawah < TINGGI_PANEL && ruangAtas > ruangBawah) {
      setPos({ left, bottom: vh - r.top + 8, maxList: Math.max(160, Math.min(288, ruangAtas - 70)) });
    } else {
      setPos({ left, top: r.bottom + 8, maxList: Math.max(160, Math.min(288, ruangBawah - 70)) });
    }
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

  // tutup bila klik di luar (tombol maupun panel portal)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (root.current?.contains(t) || panel.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // item aktif selalu terlihat saat navigasi keyboard
  useEffect(() => { aktifEl.current?.scrollIntoView({ block: "nearest" }); }, [aktif, open]);

  function buka() {
    setQ("");
    setAktif(Math.max(0, items.findIndex((i) => i.value === value)));
    setOpen(true);
  }

  function pilih(v: string) {
    onChange(v);
    setOpen(false);
    tombol.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAktif((a) => Math.min(a + 1, tampil.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAktif((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (tampil[aktif]) pilih(tampil[aktif].value); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); tombol.current?.focus(); }
  }

  return (
    <div ref={root} className="relative">
      <button ref={tombol} type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => (open ? setOpen(false) : buka())}
        className={`flex h-11 w-full min-w-40 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-left text-base text-slate-200 outline-none transition-colors hover:border-white/20 focus:border-indigo-400/60 ${className}`}>
        <span className="truncate">{terpilih?.label ?? value}</span>
        <span aria-hidden className={`shrink-0 text-xs text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={panel}
          className="pop-panel fixed z-[200] overflow-hidden rounded-xl border border-white/10 shadow-2xl"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: Math.min(LEBAR, window.innerWidth - 16) }}>
          <div className="border-b border-white/10 p-2">
            <input autoFocus value={q} placeholder={placeholder} aria-label={placeholder}
              onChange={(e) => { setQ(e.target.value); setAktif(0); }} onKeyDown={onKey}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-indigo-400/60" />
          </div>
          <ul role="listbox" className="overflow-y-auto py-1" style={{ maxHeight: pos.maxList }}>
            {tampil.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Tidak ada yang cocok.</li>}
            {tampil.map((it, i) => {
              const sel = it.value === value;
              return (
                <li key={it.value} ref={i === aktif ? aktifEl : undefined} role="option" aria-selected={sel}
                  onMouseEnter={() => setAktif(i)} onClick={() => pilih(it.value)}
                  className={`cursor-pointer truncate px-4 py-2 text-sm ${i === aktif ? "bg-indigo-500/25" : ""} ${sel ? "font-semibold text-indigo-300" : "text-slate-200"}`}>
                  {it.label}
                </li>
              );
            })}
          </ul>
          {hasil.length > MAX_TAMPIL && (
            <p className="border-t border-white/10 px-4 py-2 text-xs text-slate-500">
              Menampilkan {MAX_TAMPIL} dari {hasil.length.toLocaleString("id-ID")} — ketik untuk mempersempit.
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
