"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const input =
  "h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 pr-20 text-base text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60";

function Kolom({ id, label, value, onChange, auto, fokus }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  auto: string; fokus?: boolean;
}) {
  const [lihat, setLihat] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-[0.75rem] uppercase tracking-wider text-slate-500">{label}</label>
      <div className="relative mt-1">
        <input id={id} type={lihat ? "text" : "password"} value={value} autoFocus={fokus}
          onChange={(e) => onChange(e.target.value)} autoComplete={auto} className={input} />
        <button type="button" onClick={() => setLihat((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200">
          {lihat ? "Sembunyi" : "Lihat"}
        </button>
      </div>
    </div>
  );
}

/** Dialog ubah password milik sendiri. Dipanggil dari Navbar. */
export default function UbahPassword({ onClose }: { onClose: () => void }) {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const siap = !!lama && baru.length >= 6 && ulang === baru && !busy;

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!siap) return;
    setBusy(true);
    setPesan(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordLama: lama, passwordBaru: baru }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal mengganti password.");
      setPesan({ ok: true, teks: "Password berhasil diganti. Perangkat lain yang memakai akun ini akan otomatis keluar." });
      setLama(""); setBaru(""); setUlang("");
    } catch (err) {
      setPesan({ ok: false, teks: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // Portal ke <body>: navbar memakai backdrop-filter, yang membuat elemen "fixed" di dalamnya terkurung di navbar
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={simpan} role="dialog" aria-modal="true" aria-label="Ubah password"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--panel-bg)] p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Ubah password</h2>
            <p className="mt-1 text-sm text-slate-400">Password baru minimal 6 karakter.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="rounded-lg px-2.5 py-1 text-xl leading-none text-slate-400 hover:bg-white/5 hover:text-slate-200">×</button>
        </div>

        <div className="mt-5 space-y-4">
          <Kolom id="pw-lama" label="Password lama" value={lama} onChange={setLama} auto="current-password" fokus />
          <Kolom id="pw-baru" label="Password baru" value={baru} onChange={setBaru} auto="new-password" />
          <Kolom id="pw-ulang" label="Ulangi password baru" value={ulang} onChange={setUlang} auto="new-password" />
          {ulang && ulang !== baru && (
            <p className="text-sm text-rose-300">Ulangan password belum sama.</p>
          )}
        </div>

        {pesan && (
          <p role={pesan.ok ? "status" : "alert"}
            className={`mt-4 rounded-xl border px-3.5 py-2.5 text-sm ${pesan.ok
              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
              : "border-rose-400/25 bg-rose-500/10 text-rose-300"}`}>
            {pesan.teks}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose}
            className="h-11 rounded-xl border border-white/10 px-5 text-sm text-slate-300 hover:bg-white/5">
            {pesan?.ok ? "Tutup" : "Batal"}
          </button>
          <button type="submit" disabled={!siap}
            className="h-11 rounded-xl bg-indigo-500/90 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40">
            {busy ? "Menyimpan…" : "Simpan password"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
