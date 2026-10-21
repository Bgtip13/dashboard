"use client";
import { motion } from "framer-motion";

/** Pembungkus baris filter — satu gaya di semua halaman */
export function FilterBar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 ${className}`}>
      {children}
    </div>
  );
}

/** Grup filter dengan label kecil di kiri, supaya jelas apa yang sedang difilter */
export function FilterGroup({ label, children, grow = false }: {
  label?: string; children: React.ReactNode; grow?: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${grow ? "flex-1" : ""}`}>
      {label && <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      {children}
    </div>
  );
}

export interface PillItem<T extends string> {
  key: T;
  label: React.ReactNode;
  hint?: string;
}

/** Pill filter bersama (dipakai untuk area, periode, transaksi, alasan) */
export function FilterPills<T extends string>({
  items, value, onChange, id, size = "md", className = "",
}: {
  items: readonly PillItem<T>[];
  value: T;
  onChange: (v: T) => void;
  /** layoutId harus unik per grup pill di satu halaman */
  id: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-1.5 text-sm";
  return (
    <div className={`flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 ${className}`}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button key={it.key} onClick={() => onChange(it.key)} title={it.hint}
            className={`relative rounded-full ${pad} font-medium transition-colors ${active ? "text-indigo-200" : "text-slate-400 hover:text-slate-200"}`}>
            {active && (
              <motion.span layoutId={id} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute inset-0 rounded-full bg-indigo-500/30 ring-1 ring-indigo-400/50" />
            )}
            <span className="relative flex items-center gap-1.5">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Select dengan gaya seragam */
export function FilterSelect({ value, onChange, children, className = "", title }: {
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} title={title}
      className={`h-9 rounded-xl border border-white/10 bg-white/5 px-2.5 text-xs text-slate-200 outline-none transition-colors hover:border-white/20 focus:border-indigo-400/60 [&>option]:bg-slate-900 ${className}`}>
      {children}
    </select>
  );
}

/** Input pencarian dengan gaya seragam */
export function FilterSearch({ value, onChange, placeholder, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`h-9 min-w-48 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60 ${className}`} />
  );
}
