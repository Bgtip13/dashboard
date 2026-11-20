"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [lihat, setLihat] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; user?: { id: string; nama: string; role: "admin" | "user"; tabs: string[] } };
      if (!res.ok) throw new Error(data.error ?? "Gagal masuk.");
      // Respons login sudah memuat data akun → isi cache "me" supaya sidebar tidak menunggu /api/auth/me lagi
      if (data.user) qc.setQueryData(["me"], { user: data.user });
      else qc.removeQueries({ queryKey: ["me"] });
      const next = sp.get("next") ?? "/";
      router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const input =
    "h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 text-base text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[var(--lime-deep)]";

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-10">
      <motion.form
        onSubmit={masuk}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 sm:p-9"
      >
                <div className="relative">
          <div className="flex items-center gap-2.5 text-xl font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15161a] text-sm font-semibold text-white dark:bg-[var(--lime)] dark:text-[#15161a]">P</span> PCP Dashboard
          </div>
          <p className="lbl mt-6">Selamat datang</p>
          <h1 className="mt-1 text-[2.4rem] font-medium leading-none tracking-tight">Masuk</h1>
          <p className="mt-1 text-sm text-slate-400">Masukkan ID dan password untuk membuka dashboard.</p>

          <label className="lbl mt-6 block" htmlFor="uid">ID</label>
          <input id="uid" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username"
            autoCapitalize="none" autoFocus placeholder="ID pengguna" className={`${input} mt-1`} />

          <label className="lbl mt-4 block" htmlFor="pwd">Password</label>
          <div className="relative mt-1">
            <input id="pwd" type={lihat ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
              placeholder="Password" className={`${input} pr-24`} />
            <button type="button" onClick={() => setLihat((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200">
              {lihat ? "Sembunyi" : "Lihat"}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || !id.trim() || !password}
            className="btn-ink mt-6 h-12 w-full justify-center disabled:opacity-40">
            {busy ? "Memeriksa…" : "Masuk"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Memuat…</div>}>
      <LoginForm />
    </Suspense>
  );
}