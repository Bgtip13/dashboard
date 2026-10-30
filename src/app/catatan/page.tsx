"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import Icn from "@/components/Icn";
import {
  type Catatan, agendaContoh, cuplikan, daftarCatatan, daftarServer, idCatatan,
  judulDari, langganan, tulisCatatan, waktuSingkat,
} from "@/lib/catatan";

type Alat = { cmd: string; nilai?: string; label: string; tampil: React.ReactNode };

const GAYA = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-base text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100";

const ALAT: Alat[] = [
  { cmd: "bold", label: "Tebal", tampil: <b>B</b> },
  { cmd: "italic", label: "Miring", tampil: <i>I</i> },
  { cmd: "underline", label: "Garis bawah", tampil: <span className="underline">U</span> },
  { cmd: "strikeThrough", label: "Coret", tampil: <span className="line-through">S</span> },
  { cmd: "formatBlock", nilai: "<h2>", label: "Judul besar", tampil: <span className="text-sm font-bold">H2</span> },
  { cmd: "formatBlock", nilai: "<h3>", label: "Sub judul", tampil: <span className="text-sm font-semibold">H3</span> },
  { cmd: "formatBlock", nilai: "<p>", label: "Teks normal", tampil: <span className="text-sm">¶</span> },
  { cmd: "insertUnorderedList", label: "Daftar poin", tampil: <span className="text-lg leading-none">•</span> },
  { cmd: "insertOrderedList", label: "Daftar nomor", tampil: <span className="text-sm">1.</span> },
  { cmd: "formatBlock", nilai: "<blockquote>", label: "Kutipan", tampil: <span className="text-lg leading-none">❝</span> },
  { cmd: "hiliteColor", nilai: "rgba(250, 204, 21, 0.35)", label: "Stabilo", tampil: <span>🖍</span> },
  { cmd: "removeFormat", label: "Hapus format", tampil: <span className="text-sm">⌫</span> },
  { cmd: "undo", label: "Batalkan", tampil: <span>↶</span> },
  { cmd: "redo", label: "Ulangi", tampil: <span>↷</span> },
];

export default function CatatanPage() {
  const daftar = useSyncExternalStore(langganan, daftarCatatan, daftarServer);
  const [aktifId, setAktifId] = useState<string | null>(null);
  const [status, setStatus] = useState<"diam" | "menyimpan" | "tersimpan">("diam");

  const editRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Simpan dengan jeda supaya tidak menulis localStorage tiap ketukan. */
  function jadwalkan(list: Catatan[]) {
    setStatus("menyimpan");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      tulisCatatan(list);
      setStatus("tersimpan");
    }, 500);
  }

  const aktif = useMemo(
    () => daftar.find((c) => c.id === aktifId) ?? daftar[0] ?? null,
    [daftar, aktifId]
  );
  const idAktif = aktif?.id ?? null;
  const urut = useMemo(() => [...daftar].sort((a, b) => b.diubah - a.diubah), [daftar]);

  // Tulis isi catatan ke editor hanya saat berpindah catatan (bukan tiap ketukan)
  useEffect(() => {
    const el = editRef.current;
    if (!el) return;
    if (!idAktif) { el.innerHTML = ""; return; }
    const c = daftarCatatan().find((x) => x.id === idAktif);
    el.innerHTML = c?.isi ?? "";
  }, [idAktif]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function ubahIsi() {
    const el = editRef.current;
    if (!el || !idAktif) return;
    const list = daftarCatatan().map((c) =>
      c.id === idAktif ? { ...c, isi: el.innerHTML, diubah: Date.now() } : c
    );
    jadwalkan(list);
  }

  function ubahJudul(judul: string) {
    if (!idAktif) return;
    const list = daftarCatatan().map((c) =>
      c.id === idAktif ? { ...c, judul, diubah: Date.now() } : c
    );
    jadwalkan(list);
  }

  function buat() {
    const kosong = daftarCatatan().find(
      (c) => !c.judul.trim() && !c.isi.replace(/<br\s*\/?>/gi, "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim()
    );
    if (kosong) { setAktifId(kosong.id); editRef.current?.focus(); return; }

    const baru: Catatan = { id: idCatatan(), judul: "", isi: "", dibuat: Date.now(), diubah: Date.now() };
    tulisCatatan([baru, ...daftarCatatan()]);
    setAktifId(baru.id);
    setStatus("tersimpan");
    setTimeout(() => editRef.current?.focus(), 0);
  }

  function hapus(id: string) {
    const c = daftarCatatan().find((x) => x.id === id);
    const nama = c?.judul.trim() || judulDari(c?.isi ?? "") || "catatan ini";
    if (!window.confirm(`Hapus "${nama}"? Catatan yang dihapus tidak bisa dikembalikan.`)) return;

    const list = daftarCatatan().filter((x) => x.id !== id);
    tulisCatatan(list);
    setStatus("tersimpan");
    if (idAktif === id) setAktifId(list[0]?.id ?? null);
  }

  /** Perintah format dijalankan pada pilihan teks yang sedang aktif. */
  function perintah(cmd: string, nilai?: string) {
    const el = editRef.current;
    if (!el || !idAktif) return;
    el.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, nilai);
    ubahIsi();
  }

  function sisipkanAgenda() {
    const el = editRef.current;
    if (!el || !idAktif) return;
    const sel = window.getSelection();
    const diDalam = !!sel?.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer);
    if (diDalam) document.execCommand("insertHTML", false, agendaContoh());
    else el.innerHTML = `${el.innerHTML}${agendaContoh()}`;
    ubahIsi();
    el.focus();
  }

  const judulTampil = (c: Catatan) => c.judul.trim() || judulDari(c.isi) || "Catatan tanpa judul";

  return (
    <div className="space-y-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Catatan</h1>
          <p className="mt-1 text-base text-slate-400">
            Tulis bebas — agenda rapat, ide, atau rencana. Tersimpan otomatis di peramban ini.
          </p>
        </div>
        <button onClick={buat}
          className="flex items-center gap-2 rounded-full bg-indigo-500/25 px-5 py-2.5 text-base font-semibold text-indigo-200 ring-1 ring-indigo-400/40 transition-transform hover:scale-[1.03] active:scale-95">
          <span className="text-lg leading-none">＋</span> Catatan baru
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[19rem_1fr]">
        {/* Daftar catatan */}
        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
          <p className="px-2 py-1.5 text-xs uppercase tracking-[0.18em] text-slate-500">{daftar.length} catatan</p>
          {daftar.length === 0 ? (
            <p className="px-2 py-6 text-sm text-slate-400">Belum ada catatan. Mulai dengan “Catatan baru”.</p>
          ) : (
            <ul className="max-h-[26rem] space-y-1 overflow-y-auto">
              {urut.map((c) => {
                const on = c.id === idAktif;
                return (
                  <li key={c.id}
                    className={`group flex items-start gap-1 rounded-xl px-2 py-2 transition-colors ${on ? "bg-indigo-500/20" : "hover:bg-white/[0.06]"}`}>
                    <button onClick={() => setAktifId(c.id)} className="min-w-0 flex-1 text-left">
                      <p className={`truncate text-sm font-semibold ${on ? "text-indigo-200" : "text-slate-200"}`}>
                        {judulTampil(c)}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{cuplikan(c.isi) || "Kosong"}</p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">{waktuSingkat(c.diubah)}</p>
                    </button>
                    <button onClick={() => hapus(c.id)} title="Hapus catatan" aria-label={`Hapus ${judulTampil(c)}`}
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base leading-none text-slate-500 opacity-0 transition-all hover:bg-rose-500/20 hover:text-rose-300 focus-visible:opacity-100 group-hover:opacity-100">
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Editor */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          {!aktif ? (
            <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
              <Icn e="📝" className="h-10 w-10 text-indigo-300" />
              <p className="text-lg font-semibold">Belum ada catatan terbuka</p>
              <p className="max-w-sm text-sm text-slate-400">
                Buat catatan untuk mulai menulis agenda rapat. Semua tulisan tersimpan otomatis di peramban ini.
              </p>
              <button onClick={buat}
                className="mt-1 rounded-full bg-indigo-500/25 px-5 py-2 text-base font-semibold text-indigo-200 ring-1 ring-indigo-400/40">
                Buat catatan
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input value={aktif.judul} onChange={(e) => ubahJudul(e.target.value)}
                  placeholder="Judul catatan…" aria-label="Judul catatan"
                  className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-slate-500" />
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="tabular-nums">
                    {status === "menyimpan" ? "Menyimpan…" : status === "tersimpan" ? "Tersimpan ✓" : waktuSingkat(aktif.diubah)}
                  </span>
                  <button onClick={() => hapus(aktif.id)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/30 transition-colors hover:bg-rose-500/15">
                    Hapus
                  </button>
                </div>
              </div>

              {/* Toolbar format */}
              <div onMouseDown={(e) => e.preventDefault()}
                className="my-3 flex flex-wrap items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] px-1.5 py-1">
                {ALAT.map((a) => (
                  <button key={`${a.cmd}-${a.label}`} type="button" title={a.label} aria-label={a.label}
                    onClick={() => perintah(a.cmd, a.nilai)} className={GAYA}>
                    {a.tampil}
                  </button>
                ))}
                <span className="mx-1 h-6 w-px bg-white/10" />
                <button type="button" onClick={sisipkanAgenda} title="Sisipkan kerangka agenda rapat"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20">
                  🗓 Agenda rapat
                </button>
              </div>

              <div ref={editRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
                aria-label="Isi catatan" onInput={ubahIsi} onBlur={ubahIsi}
                className="catatan-isi min-h-[46vh] rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-[1.02rem] leading-relaxed outline-none focus:border-indigo-400/40" />

              <p className="mt-2 text-xs text-slate-500">
                Pilih teks lalu tekan alat di atas. Tulisan otomatis tersimpan di peramban ini, tidak terkirim ke server.
              </p>
            </>
          )}
        </motion.section>
      </div>
    </div>
  );
}
