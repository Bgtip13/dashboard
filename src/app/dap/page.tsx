"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fetchDap, fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { rp } from "@/lib/utils";
import DapChart from "@/features/dap/DapChart";
import DapTable from "@/features/dap/DapTable";
import TokoSalesChart from "@/features/dap/TokoSalesChart";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";
import type { DapRow } from "@/lib/types";

const MONTHS = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];

const selectCls = "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 [&>option]:bg-slate-900";

function Chip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${accent ?? "text-slate-100"}`}>{value}</p>
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
  const [selected, setSelected] = useState<DapRow | null>(null);

  const areas = useMemo(() => Array.from(new Set(all.map((r) => r.area).filter(Boolean))).sort(), [all]);
  const kabs = useMemo(() => Array.from(new Set(all.filter((r) => area === "ALL" || r.area === area).map((r) => r.kabupaten).filter(Boolean))).sort(), [all, area]);
  const kecs = useMemo(() => Array.from(new Set(all.filter((r) => (area === "ALL" || r.area === area) && (kab === "ALL" || r.kabupaten === kab)).map((r) => r.kecamatan).filter(Boolean))).sort(), [all, area, kab]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((r) =>
      (area === "ALL" || r.area === area) &&
      (kab === "ALL" || r.kabupaten === kab) &&
      (kec === "ALL" || r.kecamatan === kec) &&
      (!s || [r.toko, r.area, r.kabupaten, r.kecamatan, r.adm, r.kelasToko, r.kelasByr, r.status, r.bulanPasif].join(" ").toLowerCase().includes(s))
    );
  }, [all, area, kab, kec, q]);

  const totalToko = rows.length;
  const act = rows.reduce((s, r) => s + (r.bulanan[monthIdx] ?? 0), 0);
  const sumStoreTarget = rows.reduce((s, r) => s + r.targetToko, 0);
  const omset = rows.reduce((s, r) => s + r.omsetYtd, 0);

  const totalTarget = useMemo(() => {
    const mrows = monthly?.rows ?? [];
    const hit = mrows.find((r) => (area === "ALL" ? r.area === "GLOBAL" : r.area === area));
    return hit && hit.target > 0 ? hit.target : sumStoreTarget;
  }, [monthly, area, sumStoreTarget]);

  const pcp = totalTarget ? (act / totalTarget) * 100 : 0;
  const badge = getBadge(pcp);
  const monthlyTotals = useMemo(() => MONTHS.map((_, i) => rows.reduce((s, r) => s + (r.bulanan[i] ?? 0), 0)), [rows]);

  const sAktif = selected ? selected.bulanan.filter((v) => v > 0).length : 0;
  const sAvg = selected ? selected.omsetYtd / (sAktif || 1) : 0;
  const sPcp = selected && selected.targetToko ? ((selected.bulanan[monthIdx] ?? 0) / selected.targetToko) * 100 : 0;
  const sBadge = getBadge(sPcp);

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">DAP — Rincian Detail Toko</h1>
        <p className="text-sm text-slate-400">
          {isLoading ? "Memuat…" : `${all.length} toko · Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}
        </p>
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Toko", node: <CountUp value={totalToko} className="block text-2xl font-bold" /> },
          { label: `Total Act (${MONTHS[monthIdx]})`, node: <CountUp value={act} format={rp} className="block text-2xl font-bold text-emerald-300" /> },
          { label: "Total Target", node: <CountUp value={totalTarget} format={rp} className="block text-2xl font-bold" /> },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">{c.label}</p>
            <div className="mt-1">{c.node}</div>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Pencapaian</p>
          <div className="mt-1 flex items-center gap-2">
            <CountUp value={pcp} format={(v) => `${v.toFixed(1)}%`} className="text-2xl font-bold" />
            <Icn e={badge.emoji} className="h-3.5 w-3.5" />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pcp, 100)}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${badge.bg}, ${badge.color})` }} />
          </div>
        </motion.div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Omset per Bulan (Jan–Des)</p>
        <DapChart values={monthlyTotals} selectedMonth={monthIdx} />
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
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Chip label="Omset YTD" value={rp(selected.omsetYtd)} accent="text-emerald-300" />
            <Chip label="Target/bulan" value={rp(selected.targetToko)} />
            <Chip label="Bulan aktif" value={`${sAktif} bln`} />
            <Chip label="Rata-rata/bln" value={rp(sAvg)} />
            <Chip label={`PCP ${MONTHS[monthIdx]}`}
              value={sPcp > 0 ? `${sPcp.toFixed(0)}%` : "—"}
              accent={sPcp >= 100 ? "text-emerald-300" : sPcp >= 85 ? "text-yellow-300" : "text-orange-300"} />
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
