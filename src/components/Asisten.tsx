"use client";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  actionUrl, EMPTY_OPTIONS,
  type AsistenAction, type AsistenOptions, type AsistenResult,
} from "@/lib/asisten";
import Icn from "./Icn";
import FridayLogo from "./FridayLogo";

type Msg = { id: number; role: "user" | "ai"; text: string; action?: AsistenAction | null };

type DapCache = { rows?: { area?: string; kabupaten?: string; kecamatan?: string }[] };
type ProdukCache = { rows?: { area?: string; kategori?: string; brand?: string }[] };
type MonthlyCache = { rows?: { area?: string }[] };

const SARAN = [
  "Buka DAP toko tanpa transaksi",
  "Toko omset tertinggi kabupaten Sleman",
  "Produk qty terbanyak brand Me-o",
  "Pencapaian mingguan area Solo minggu 2",
];

const uniq = (xs: (string | undefined)[]) =>
  Array.from(new Set(xs.filter((x): x is string => Boolean(x && x.trim())).map((x) => x.trim()))).slice(0, 400);

/** Sapaan sesuai jam (dipakai saat panel dibuka, jadi aman dari hydration mismatch). */
function sapaWaktu(): string {
  const jam = new Date().getHours();
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Opsi filter diambil dari data yang sudah dimuat halaman lain (kalau ada). */
function collectOptions(qc: QueryClient): AsistenOptions {
  const dap = qc.getQueryData<DapCache>(["dap"]);
  const produk = qc.getQueryData<ProdukCache>(["produk"]);
  const monthly = qc.getQueryData<MonthlyCache>(["monthly"]);
  if (!dap && !produk && !monthly) return EMPTY_OPTIONS;
  return {
    areas: uniq([...(dap?.rows ?? []).map((r) => r.area), ...(monthly?.rows ?? []).map((r) => r.area)]),
    kabupaten: uniq((dap?.rows ?? []).map((r) => r.kabupaten)),
    kecamatan: uniq((dap?.rows ?? []).map((r) => r.kecamatan)),
    brands: uniq((produk?.rows ?? []).map((r) => r.brand)),
    kategori: uniq((produk?.rows ?? []).map((r) => r.kategori)),
  };
}

export default function Asisten() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const router = useRouter();
  const qc = useQueryClient();

  const nextId = () => (idRef.current += 1);
  /** simpan hanya 40 pesan terakhir supaya panel tetap ringan */
  const pushMsg = (msg: Msg) => setMessages((m) => [...m, msg].slice(-40));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  async function kirim(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    pushMsg({ id: nextId(), role: "user", text });

    try {
      const res = await fetch("/api/asisten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, options: collectOptions(qc) }),
      });
      const data = (await res.json()) as AsistenResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Asisten sedang tidak bisa dihubungi.");

      pushMsg({ id: nextId(), role: "ai", text: data.reply, action: data.action });
      if (data.action) router.push(actionUrl(data.action));
    } catch (err) {
      pushMsg({
        id: nextId(),
        role: "ai",
        text: `Maaf Bos, ada gangguan di sistem: ${(err as Error).message}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Tutup F.R.I.D.A.Y" : "Buka F.R.I.D.A.Y"}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full border border-cyan-300/35 bg-[#0b1020]/95 py-2 pl-2 pr-5 text-base font-semibold text-white shadow-[0_10px_30px_rgba(34,211,238,0.22)] backdrop-blur transition-transform hover:scale-105 active:scale-95"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/15 to-indigo-500/20 ring-1 ring-cyan-300/30">
          <FridayLogo size={28} active={busy || open} />
        </span>
        <span className="hidden tracking-[0.12em] sm:inline">F.R.I.D.A.Y</span>
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse bg-amber-300" : "bg-emerald-400"}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            role="dialog"
            aria-label="F.R.I.D.A.Y — asisten data PCP"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed bottom-20 right-5 z-50 flex max-h-[min(640px,calc(100vh-8rem))] w-[min(94vw,430px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[var(--panel-bg)] shadow-2xl backdrop-blur"
          >
            <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-cyan-500/[0.06] to-transparent px-4 py-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--logo-bg)] ring-1 ring-cyan-300/25">
                <FridayLogo size={32} active={busy || open} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-base font-semibold tracking-[0.14em]">
                  F.R.I.D.A.Y
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wider text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online
                  </span>
                </p>
                <p className="text-sm text-slate-400">Asisten SPV — Semua sistem siap, Bos.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Tutup F.R.I.D.A.Y"
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200">✕</button>
            </div>

            <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3.5">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm leading-relaxed text-slate-300">
                  {sapaWaktu()}, Bos. <span className="font-semibold tracking-wide text-cyan-300">F.R.I.D.A.Y</span> online
                  dan semua sistem siap. Data PCP sudah terhubung.
                  <br />
                  Mau saya bukakan halaman atau data yang mana? Contohnya
                  <span className="text-cyan-300"> “buka DAP toko tanpa transaksi di Semarang bulan ini”</span>.
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-indigo-500/25 text-slate-100"
                        : "border border-white/10 bg-white/[0.05] text-slate-200"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>
                    {m.action && (
                      <button
                        onClick={() => { if (m.action) router.push(actionUrl(m.action)); }}
                        className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-indigo-300 hover:text-indigo-200"
                      >
                        Tampilkan lagi →
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-300"
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SARAN.map((s) => (
                    <button key={s} onClick={() => kirim(s)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-indigo-400/40 hover:text-indigo-200">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); kirim(input); }}
              className="flex items-center gap-2 border-t border-white/10 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Perintah, Bos…"
                aria-label="Perintah untuk F.R.I.D.A.Y"
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60"
              />
              <button type="submit" disabled={busy || !input.trim()}
                className="flex h-12 items-center gap-1 rounded-xl bg-indigo-500/90 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40">
                <Icn e="➤" className="h-4 w-4" />
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
