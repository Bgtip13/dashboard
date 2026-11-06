"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { waktuSingkat } from "@/lib/catatan";
import { TAB_LIST, ALL_TAB_KEYS } from "@/lib/tabs";

type U = { id: string; nama: string; role: "admin" | "user"; dibuat: number; tabs: string[] };

/** Centang tab apa saja yang boleh dibuka sebuah akun. */
function TabPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (k: string) =>
    onChange(value.includes(k) ? value.filter((x) => x !== k) : ALL_TAB_KEYS.filter((x) => x === k || value.includes(x)));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TAB_LIST.map((t) => {
        const on = value.includes(t.key);
        return (
          <label key={t.key}
            className={`flex cursor-pointer select-none items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${on
              ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-200"
              : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"}`}>
            <input type="checkbox" checked={on} onChange={() => toggle(t.key)} className="h-4 w-4 accent-indigo-500" />
            {t.label}
          </label>
        );
      })}
      <button type="button" onClick={() => onChange(value.length === ALL_TAB_KEYS.length ? [] : [...ALL_TAB_KEYS])}
        className="px-2 text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">
        {value.length === ALL_TAB_KEYS.length ? "Kosongkan" : "Pilih semua"}
      </button>
    </div>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Terjadi kesalahan."), { status: res.status });
  return data as T;
}

const input =
  "h-11 min-w-0 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60";

export default function PenggunaPage() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: U[] }>("/api/users"),
    retry: false,
  });

  const [id, setId] = useState("");
  const [nama, setNama] = useState("");
  const [pw, setPw] = useState("");
  const [tabsBaru, setTabsBaru] = useState<string[]>([...ALL_TAB_KEYS]);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editPw, setEditPw] = useState("");
  const [editTabs, setEditTabs] = useState<string[]>([]);

  const segarkan = () => qc.invalidateQueries({ queryKey: ["users"] });
  const info = (ok: boolean, teks: string) => setPesan({ ok, teks });

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify({ id, nama, password: pw, tabs: tabsBaru }) });
      info(true, `User "${id.trim().toLowerCase()}" ditambahkan.`);
      setId(""); setNama(""); setPw(""); setTabsBaru([...ALL_TAB_KEYS]);
      segarkan();
    } catch (err) {
      info(false, (err as Error).message);
    }
  }

  async function simpan(u: U) {
    try {
      await api(`/api/users/${encodeURIComponent(u.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          nama: editNama,
          password: editPw || undefined,
          // akun utama selalu semua tab, tidak perlu dikirim
          tabs: u.role === "admin" ? undefined : editTabs,
        }),
      });
      info(true, `Data "${u.id}" diperbarui${editPw ? " (password diganti, sesi lamanya otomatis keluar)" : ""}.`);
      setEdit(null);
      setEditPw("");
      segarkan();
    } catch (err) {
      info(false, (err as Error).message);
    }
  }

  async function hapus(u: U) {
    if (!window.confirm(`Hapus user "${u.id}"? Ia langsung tidak bisa masuk lagi.`)) return;
    try {
      await api(`/api/users/${encodeURIComponent(u.id)}`, { method: "DELETE" });
      info(true, `User "${u.id}" dihapus.`);
      segarkan();
    } catch (err) {
      info(false, (err as Error).message);
    }
  }

  if ((error as { status?: number } | null)?.status === 403) {
    return (
      <div className="py-10">
        <h1 className="text-3xl font-bold">Pengguna</h1>
        <p className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-300">
          Halaman ini hanya untuk akun utama.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold">Pengguna</h1>
        <p className="text-sm text-slate-400">Tambah akun, ubah password, atur tab yang boleh dibuka tiap akun, atau hapus akun.</p>
      </div>

      <form onSubmit={tambah} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm uppercase tracking-wider text-slate-400">Tambah user</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID (mis. andi)"
            autoCapitalize="none" autoComplete="off" className={`${input} w-40`} />
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama (opsional)"
            autoComplete="off" className={`${input} w-52`} />
          <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password (min. 6)"
            type="text" autoComplete="new-password" className={`${input} w-52`} />
          <button type="submit" disabled={!id.trim() || pw.length < 6}
            className="h-11 rounded-xl bg-indigo-500/90 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40">
            ＋ Tambah
          </button>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-[0.75rem] uppercase tracking-wider text-slate-500">Tab yang boleh dibuka</p>
          <TabPicker value={tabsBaru} onChange={setTabsBaru} />
        </div>
        {pesan && (
          <p role="status" className={`mt-3 text-sm ${pesan.ok ? "text-emerald-300" : "text-rose-300"}`}>{pesan.teks}</p>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="tbl-scroll">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-sm uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Nama</th>
                <th className="px-5 py-3.5">Peran</th>
                <th className="px-5 py-3.5">Akses tab</th>
                <th className="px-5 py-3.5">Dibuat</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Memuat…</td></tr>
              )}
              {(data?.users ?? []).map((u, i) => {
                const sedangEdit = edit === u.id;
                return (
                  <motion.tr key={u.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }} className="border-b border-white/5 align-top">
                    <td className="px-5 py-3.5 font-medium">{u.id}</td>
                    <td className="px-5 py-3.5">
                      {sedangEdit ? (
                        <div className="flex flex-wrap gap-2">
                          <input value={editNama} onChange={(e) => setEditNama(e.target.value)}
                            placeholder="Nama" className={`${input} w-44`} />
                          <input value={editPw} onChange={(e) => setEditPw(e.target.value)}
                            placeholder="Password baru (kosong = tetap)" autoComplete="new-password"
                            className={`${input} w-64`} />
                        </div>
                      ) : u.nama}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-sm ${u.role === "admin"
                        ? "bg-amber-500/15 text-amber-300" : "bg-indigo-500/15 text-indigo-300"}`}>
                        {u.role === "admin" ? "Akun utama" : "User"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.role === "admin" ? (
                        <span className="text-sm text-slate-400">Semua tab + Pengguna</span>
                      ) : sedangEdit ? (
                        <TabPicker value={editTabs} onChange={setEditTabs} />
                      ) : u.tabs.length === 0 ? (
                        <span className="text-sm text-rose-300">Tidak ada (hanya Beranda)</span>
                      ) : u.tabs.length === ALL_TAB_KEYS.length ? (
                        <span className="text-sm text-slate-400">Semua tab</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {TAB_LIST.filter((t) => u.tabs.includes(t.key)).map((t) => (
                            <span key={t.key} className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-sm text-indigo-300">{t.label}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{waktuSingkat(u.dibuat)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
                        {sedangEdit ? (
                          <>
                            <button onClick={() => simpan(u)}
                              className="rounded-lg bg-indigo-500/90 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500">Simpan</button>
                            <button onClick={() => { setEdit(null); setEditPw(""); }}
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-400 hover:bg-white/5">Batal</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEdit(u.id); setEditNama(u.nama); setEditPw(""); setEditTabs(u.tabs); }}
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5">Edit / Akses</button>
                            {u.role !== "admin" && (
                              <button onClick={() => hapus(u)}
                                className="rounded-lg px-3 py-1.5 font-semibold text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/15">Hapus</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}