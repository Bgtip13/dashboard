"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchDap, fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { rp, rpShort } from "@/lib/utils";
import {
  KATEGORI, URUTAN_TANPA, kategori, hilangPerBulan, hilangPerKabupaten,
  isKerugian, ringkasSegmentasi, type AlasanFilter, type TrxFilter,
} from "@/lib/dapSegment";
import DapChart from "@/features/dap/DapChart";
import DapTable from "@/features/dap/DapTable";
import TokoSalesChart from "@/features/dap/TokoSalesChart";
import KomposisiToko from "@/features/dap/KomposisiToko";
import HilangPerKabupaten from "@/features/dap/HilangPerKabupaten";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";
import type { DapRow } from "@/lib/types";

const MONTHS = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];

const selectCls = "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 [&>option]:bg-slate-900";

function Chip({ label, value, accent, dot }: { label: string; value: string; accent?: string; dot?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`flex items-center gap-1.5 text-sm font-bold ${accent ?? "text-slate-100"}`}>
        {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />}
        {value}
      </p>
    </div>
  );
}

function Kpi({ label, sub, delay, children }: {
  label: string; sub?: React.ReactNode; delay: number; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-1">{children}</div>
      {sub && <p className="mt-1 text-[11px] leading-tight text-slate-500">{sub}</p>}
    </motion.div>
  );
}

function Seg({ items, value, onChange, layoutId }: {
  items: { key: string; label: string; count: number; color?: string; hint?: string }[];
  value: string; onChange: (k: string) => void; layoutId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button key={it.key} onClick={() => onChange(it.key)} title={it.hint}
            className={`relative rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${active ? "text-slate-100" : "text-slate-400 hover:text-slate-200"}`}>
            {active && (
              <motion.span layoutId={layoutId} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute inset-0 rounded-xl bg-indigo-500/25 ring-1 ring-indigo-400/40" />
            )}
            <span className="relative flex items-center gap-1.5">
              {it.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: it.color }} />}
              {it.label}
              <span className={`rounded-md px-1 py-px text-[10px] ${active ? "bg-indigo-500/25 text-indigo-200" : "bg-white/10 text-slate-400"}`}>
                {it.count}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function DapPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dap"], queryFn: fetchDap });
  const { data: monthly } = useQuery({ queryKey: ["monthly"], queryFn: fetchMonthly });
  const all = data?.rows ?? [];

  const [area, setArea] = useState("ALL");
  const [kab, setKab] = useState("ALL");
  const [kec, setKec] = useState("ALL");
  const [q, setQ] = useState("");
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [trx, setTrx] = useState<TrxFilter>("ALL");
  const [alasan, setAlasan] = useState<AlasanFilter>("ALL");
  const [selected, setSelected] = useState<DapRow | null>(null);

  const areas = useMemo(() => Array.from(new Set(all.map((r) => r.area).filter(Boolean))).sort(), [all]);
  const kabs = useMemo(() => Array.from(new Set(all.filter((r) => area === "ALL" || r.area === area).map((r) => r.kabupaten).filter(Boolean))).sort(), [all, area]);
  const kecs = useMemo(() => Array.from(new Set(all.filter((r) => (area === "ALL" || r.area === area) && (kab === "ALL" || r.kabupaten === kab)).map((r) => r.kecamatan).filter(Boolean))).sort(), [all, area, kab]);

  // baris sebelum filter transaksi (dipakai untuk menghitung angka di chip filter)
  const baseRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((r) =>
      (area === "ALL" || r.area === area) &&
      (kab === "ALL" || r.kabupaten === kab) &&
      (kec === "ALL" || r.kecamatan === kec) &&
      (!s || [r.toko, r.area, r.kabupaten, r.kecamatan, r.adm, r.kelasToko, r.kelasByr, r.status, r.bulanPasif].join(" ").toLowerCase().includes(s))
    );
  }, [all, area, kab, kec, q]);

  const segBase = useMemo(() => ringkasSegmentasi(baseRows, monthIdx), [baseRows, monthIdx]);

  const rows = useMemo(() => {
    if (trx === "ALL") return baseRows;
    return baseRows.filter((r) => {
      const k = kategori(r, monthIdx);
      if (trx === "AKTIF") return k === "AKTIF";
      return k !== "AKTIF" && (alasan === "ALL" || k === alasan);
    });
  }, [baseRows, trx, alasan, monthIdx]);

  const seg = useMemo(() => ringkasSegmentasi(rows, monthIdx), [rows, monthIdx]);
  const lossMonthly = useMemo(() => hilangPerBulan(rows, monthIdx), [rows, monthIdx]);
  const lossKab = useMemo(() => hilangPerKabupaten(rows, monthIdx), [rows, monthIdx]);

  const totalToko = rows.length;
  const act = rows.reduce((s, r) => s + (r.bulanan[monthIdx] ?? 0), 0);
  const sumStoreTarget = rows.reduce((s, r) => s + r.targetToko, 0);
  const omset = rows.reduce((s, r) => s + r.omsetYtd, 0);

  // PCP memakai target resmi dari sheet Bulanan; saat filter toko aktif, pakai jumlah target toko terfilter
  const storeScoped = trx !== "ALL" || q.trim() !== "" || kec !== "ALL" || kab !== "ALL";
  const totalTarget = useMemo(() => {
    if (storeScoped) return sumStoreTarget;
    const mrows = monthly?.rows ?? [];
    const hit = mrows.find((r) => (area === "ALL" ? r.area === "GLOBAL" : r.area === area));
    return hit && hit.target > 0 ? hit.target : sumStoreTarget;
  }, [monthly, area, storeScoped, sumStoreTarget]);
  const lossPct = totalTarget ? (seg.hilangNominal / totalTarget) * 100 : 0;

  const pcp = totalTarget ? (act / totalTarget) * 100 : 0;
  const badge = getBadge(pcp);
  const monthlyTotals = useMemo(() => MONTHS.map((_, i) => rows.reduce((s, r) => s + (r.bulanan[i] ?? 0), 0)), [rows]);

  const sAktif = selected ? selected.bulanan.filter((v) => v > 0).length : 0;
  const sAvg = selected ? selected.omsetYtd / (sAktif || 1) : 0;
  const sPcp = selected && selected.targetToko ? ((selected.bulanan[monthIdx] ?? 0) / selected.targetToko) * 100 : 0;
  const sKat = selected ? kategori(selected, monthIdx) : null;

  const trxItems = [
    { key: "ALL", label: "Semua", count: segBase.total, hint: "Tampilkan semua toko" },
    { key: "AKTIF", label: "Ada transaksi", count: segBase.perKategori.AKTIF.toko, color: KATEGORI.AKTIF.color, hint: KATEGORI.AKTIF.desc },
    { key: "TANPA", label: "Tanpa transaksi", count: segBase.tanpa.toko, color: KATEGORI.IDLE2.color, hint: `Berhenti bulan ini, ≥2 bulan kosong, belum pernah transaksi, dan toko tutup` },
  ];
  const alasanItems = [
    { key: "ALL", label: "Semua alasan", count: segBase.tanpa.toko },
    ...URUTAN_TANPA.map((k) => ({ key: k, label: KATEGORI[k].short, count: segBase.perKategori[k].toko, color: KATEGORI[k].color, hint: KATEGORI[k].desc })),
  ];

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">DAP — Rincian Detail Toko</h1>
        <p className="text-sm text-slate-400">
          {isLoading ? "Memuat…" : `${rows.length === all.length ? all.length : `${rows.length} dari ${all.length}`} toko · Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectCls} value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select className={selectCls} value={area} onChange={(e) => { setArea(e.target.value); setKab("ALL"); setKec("ALL"); }}>
            <option value="ALL">Semua Area</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className={selectCls} value={kab} onChange={(e) => { setKab(e.target.value); setKec("ALL"); }}>
            <option value="ALL">Semua Kabupaten</option>
            {kabs.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select className={selectCls} value={kec} onChange={(e) => setKec(e.target.value)}>
            <option value="ALL">Semua Kecamatan</option>
            {kecs.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Cari apa saja…"
            className="min-w-56 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-400/50 focus:outline-none" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="pl-1 text-[10px] uppercase tracking-wider text-slate-500">Transaksi</span>
          <Seg items={trxItems} value={trx} onChange={(k) => setTrx(k as TrxFilter)} layoutId="dap-trx" />
        </div>

        <AnimatePresence initial={false}>
          {trx === "TANPA" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-2 overflow-hidden">
              <span className="pl-1 text-[10px] uppercase tracking-wider text-slate-500">Alasan</span>
              <Seg items={alasanItems} value={alasan} onChange={(k) => setAlasan(k as AlasanFilter)} layoutId="dap-alasan" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total Toko" delay={0} sub={`${seg.aktif.toko} ada transaksi · ${seg.tanpa.toko} tanpa transaksi`}>
          <CountUp value={totalToko} className="block text-2xl font-bold" />
        </Kpi>
        <Kpi label={`Total Act (${MONTHS[monthIdx]})`} delay={0.08}
          sub={lossPct > 0 ? `${lossPct.toFixed(1)}% target hilang karena toko tanpa transaksi` : "Tidak ada nominal hilang pada filter ini"}>
          <CountUp value={act} format={rp} className="block text-2xl font-bold text-emerald-300" />
        </Kpi>
        <Kpi label="Total Target" delay={0.16} sub={`${totalToko} toko terfilter`}>
          <CountUp value={totalTarget} format={rp} className="block text-2xl font-bold" />
        </Kpi>
        <Kpi label="Pencapaian" delay={0.24}
          sub={`Toko tanpa transaksi: ${seg.pctTokoTanpa.toFixed(1)}% dari total toko`}>
          <div className="flex items-center gap-2">
            <CountUp value={pcp} format={(v) => `${v.toFixed(1)}%`} className="text-2xl font-bold" />
            <Icn e={badge.emoji} className="h-3.5 w-3.5" />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pcp, 100)}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${badge.bg}, ${badge.color})` }} />
          </div>
        </Kpi>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-rose-400/25 bg-rose-500/[0.06] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-rose-300">Nominal Hilang · {MONTHS[monthIdx]}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <CountUp value={seg.hilangNominal} format={rp} className="text-2xl font-bold text-rose-300" />
              <span className="text-xs text-slate-400">
                {seg.hilangToko} toko · {lossPct.toFixed(1)}% dari target {rp(totalTarget)}
              </span>
            </div>
          </div>
          <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">
            Dihitung dari target toko yang sudah pernah transaksi lalu 0 di bulan terpilih.
            {seg.bukanKerugianToko > 0 && (
              <> {seg.perKategori.BELUM.toko} toko belum pernah transaksi dan {seg.perKategori.TUTUP.toko} toko tutup/DO NOT ORDER
                (target {rpShort(seg.bukanKerugianNominal)}) tidak dihitung sebagai kerugian.</>
            )}
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(lossPct, 100)}%` }}
            transition={{ duration: 1.1, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400" />
        </div>

        {seg.tanpa.toko > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {URUTAN_TANPA.filter((k) => seg.perKategori[k].toko > 0).map((k) => (
              <button key={k} onClick={() => { setTrx("TANPA"); setAlasan(k); }}
                title={`Klik untuk memfilter: ${KATEGORI[k].desc}`}
                className={`rounded-xl border px-2.5 py-2 text-left transition-colors hover:bg-white/5 ${isKerugian(k) ? "border-rose-400/25 bg-rose-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: KATEGORI[k].color }} />
                  {KATEGORI[k].short}
                </p>
                <p className="text-sm font-bold text-slate-100">{seg.perKategori[k].toko} toko</p>
                <p className={`text-[10px] ${isKerugian(k) ? "text-rose-300" : "text-slate-500"}`}>
                  {isKerugian(k) ? `hilang ${rpShort(seg.perKategori[k].target)}` : `target ${rpShort(seg.perKategori[k].target)} · bukan kerugian`}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-slate-500">
            Tidak ada toko tanpa transaksi pada filter ini — nominal hilang Rp0.
          </p>
        )}
      </motion.div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-slate-400">Omset per Bulan (Jan–Des)</p>
          <p className="text-[11px] text-slate-500">Blok penuh = aktual · blok garis = target toko yang tidak transaksi di bulan itu</p>
        </div>
        <DapChart values={monthlyTotals} loss={lossMonthly} selectedMonth={monthIdx} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-slate-400">Komposisi Toko · {MONTHS[monthIdx]}</p>
            <p className="text-[11px] text-slate-500">{seg.tanpa.toko} toko tanpa transaksi ({seg.pctTokoTanpa.toFixed(1)}%)</p>
          </div>
          <KomposisiToko ringkas={seg} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-slate-400">Top 8 Kabupaten · Nominal Hilang</p>
            <p className="text-[11px] text-slate-500">{seg.hilangToko} toko · {rpShort(seg.hilangNominal)}</p>
          </div>
          {lossKab.length > 0 ? (
            <HilangPerKabupaten data={lossKab} />
          ) : (
            <div className="flex h-64 items-center justify-center text-center text-xs text-slate-500">
              Belum ada nominal hilang pada filter ini.
            </div>
          )}
        </div>
      </div>

      {selected && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-indigo-400/25 bg-white/[0.04] p-4 shadow-[0_0_40px_rgba(99,102,241,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-slate-100">{selected.toko}</p>
              <p className="text-xs text-slate-400">
                {selected.area} · {selected.kabupaten} · {selected.kecamatan} · ADM {selected.adm || "-"} · {selected.kelasToko || "-"}/{selected.kelasByr || "-"} · {selected.status}
              </p>
            </div>
            <button onClick={() => setSelected(null)}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200">✕ Tutup</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Chip label="Omset YTD" value={rp(selected.omsetYtd)} accent="text-emerald-300" />
            <Chip label="Target/bulan" value={rp(selected.targetToko)} />
            <Chip label="Bulan aktif" value={`${sAktif} bln`} />
            <Chip label="Rata-rata/bln" value={rp(sAvg)} />
            <Chip label={`PCP ${MONTHS[monthIdx]}`}
              value={sPcp > 0 ? `${sPcp.toFixed(0)}%` : "—"}
              accent={sPcp >= 100 ? "text-emerald-300" : sPcp >= 85 ? "text-yellow-300" : "text-orange-300"} />
            {sKat && (
              <Chip label="Kategori" dot={KATEGORI[sKat].color}
                value={isKerugian(sKat) ? `${KATEGORI[sKat].short} · hilang ${rpShort(selected.targetToko)}` : KATEGORI[sKat].short}
                accent={isKerugian(sKat) ? "text-rose-300" : sKat === "AKTIF" ? "text-emerald-300" : "text-slate-200"} />
            )}
          </div>
          <div className="mt-3">
            <TokoSalesChart values={selected.bulanan} target={selected.targetToko} />
          </div>
        </motion.div>
      )}

      <DapTable rows={rows} monthIdx={monthIdx} totalOmset={omset}
        onSelect={setSelected} selectedToko={selected?.toko ?? null} />
    </div>
  );
}
