"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchItem { value: string; label: string }

const MAX_TAMPIL = 150; // daftar sangat panjang (mis. ratusan toko) cukup dirender sebagian, sisanya lewat pencarian

/**
 * Pengganti <select> dengan kotak cari di dalamnya.
 * Klik → muncul daftar + search bar; ketik untuk menyaring; ↑ ↓ Enter Esc untuk keyboard.
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
  const root = useRef<HTMLDivElement | null>(null);
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

  // tutup bila klik di luar
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
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
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAktif((a) => Math.min(a + 1, tampil.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAktif((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (tampil[aktif]) pilih(tampil[aktif].value); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => (open ? setOpen(false) : buka())}
        className={`flex h-11 w-full min-w-40 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-left text-base text-slate-200 outline-none transition-colors hover:border-white/20 focus:border-indigo-400/60 ${className}`}>
        <span className="truncate">{terpilih?.label ?? value}</span>
        <span aria-hidden className={`shrink-0 text-xs text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 max-w-[85vw] overflow-hidden rounded-xl border border-white/10 bg-[var(--panel-bg)] shadow-2xl">
          <div className="border-b border-white/10 p-2">
            <input autoFocus value={q} placeholder={placeholder} aria-label={placeholder}
              onChange={(e) => { setQ(e.target.value); setAktif(0); }} onKeyDown={onKey}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-indigo-400/60" />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
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
        </div>
      )}
    </div>
  );
}
