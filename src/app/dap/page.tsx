"use client";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { fetchDap, fetchMonthly } from "@/lib/api";
import { getBadge } from "@/lib/badge";
import { rp, rpShort } from "@/lib/utils";
import {
  KATEGORI, URUTAN_TANPA, cocokTren, diBawahTarget, kategori, hilangPerBulan, hilangPerKabupaten,
  isKerugian, ringkasSegmentasi, ringkasTren, type AlasanFilter, type TrenFilter, type TrxFilter,
} from "@/lib/dapSegment";
import DapChart from "@/features/dap/DapChart";
import DapTable from "@/features/dap/DapTable";
import TokoSalesChart from "@/features/dap/TokoSalesChart";
import KomposisiToko from "@/features/dap/KomposisiToko";
import HilangPerKabupaten from "@/features/dap/HilangPerKabupaten";
import CountUp from "@/components/CountUp";
import Icn from "@/components/Icn";
import { FilterBar, FilterGroup, FilterPills, FilterSelect, FilterSearch } from "@/components/FilterBar";
import { DAP_SORT_KEYS } from "@/lib/asisten";
import type { DapRow } from "@/lib/types";

const MONTHS = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];

/** titik warna kategori + jumlah, dipakai di pill filter */
const dot = (c: string) => <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />;
const countChip = (n: React.ReactNode) => <span className="rounded-md bg-white/10 px-1 py-px text-[0.75rem] tabular-nums">{n}</span>;

function Chip({ label, value, accent, dot }: { label: string; value: string; accent?: string; dot?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[0.75rem] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`flex items-center gap-1.5 text-sm font-bold ${accent ?? "text-slate-100"}`}>
        {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />}
        {value}
      </p>
    </div>
  );
}

/** Satu petak komposisi gap target — bisa diklik untuk memfilter tabel */
function GapTile({ label, toko, sub, tone, onClick, active }: {
  label: string; toko: number; sub: string;
  tone: "loss" | "neutral" | "under" | "over";
  onClick?: () => void; active?: boolean;
}) {
  const color = tone === "loss" ? "text-rose-300"
    : tone === "under" ? "text-amber-300"
      : tone === "over" ? "text-emerald-300" : "text-slate-300";
  const cls = `rounded-xl border px-2.5 py-2 text-left transition-colors ${active ? "border-indigo-400/50 bg-indigo-500/10" : "border-white/10 bg-white/[0.03]"}`;
  const body = (
    <>
      <p className="flex items-center justify-between gap-2 text-[0.75rem] uppercase tracking-wide text-slate-400">
        <span className="min-w-0 truncate" title={label}>{label}</span>
        {onClick && <span className="shrink-0 text-[0.7rem] text-slate-500">{active ? "aktif" : "filter"}</span>}
      </p>
      <p className={`mt-0.5 text-sm font-bold ${color}`}>{toko} toko</p>
      <p className="truncate text-[0.75rem] text-slate-500" title={sub}>{sub}</p>
    </>
  );
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button onClick={onClick} title={`Klik untuk memfilter: ${label}`} className={`${cls} hover:bg-white/5`}>
      {body}
    </button>
  );
}

function Kpi({ label, sub, delay, children }: {
  label: string; sub?: React.ReactNode; delay: number; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-1">{children}</div>
      {sub && <p className="mt-1 text-[0.8rem] leading-tight text-slate-500">{sub}</p>}
    </motion.div>
  );
}

function DapPageContent() {
  const sp = useSearchParams();
  const { data, isLoading } = useQuery({ queryKey: ["dap"], queryFn: fetchDap });
  const { data: monthly } = useQuery({ queryKey: ["monthly"], queryFn: fetchMonthly });
  const all = useMemo(() => data?.rows ?? [], [data]);

  // Filter awal bisa datang dari Asisten AI lewat query string (?area=&kab=&q=…)
  const [area, setArea] = useState(() => (sp.get("area") ?? "").trim().toUpperCase() || "ALL");
  const [kab, setKab] = useState(() => (sp.get("kab") ?? "").trim() || "ALL");
  const [kec, setKec] = useState(() => (sp.get("kec") ?? "").trim() || "ALL");
  const [q, setQ] = useState(() => sp.get("q") ?? "");
  const [monthIdx, setMonthIdx] = useState(() => {
    const raw = (sp.get("bulan") ?? "").trim();
    if (/^\d{1,2}$/.test(raw)) {
      const n = Number(raw);
      if (n >= 0 && n <= 11) return n;
    }
    return new Date().getMonth();
  });
  const [trx, setTrx] = useState<TrxFilter>(() => {
    const raw = (sp.get("trx") ?? "").toUpperCase();
    return (["ALL", "AKTIF", "BAWAH", "TANPA"] as const).includes(raw as TrxFilter) ? (raw as TrxFilter) : "ALL";
  });
  const [alasan, setAlasan] = useState<AlasanFilter>(() => {
    const raw = (sp.get("alasan") ?? "").toUpperCase();
    return (["ALL", "BERHENTI", "IDLE2", "BELUM", "TUTUP"] as const).includes(raw as AlasanFilter)
      ? (raw as AlasanFilter) : "ALL";
  });
  // Tren bulan ini vs bulan lalu (dipakai F.R.I.D.A.Y untuk "penjualan turun")
  const [tren, setTren] = useState<TrenFilter>(() => {
    const raw = (sp.get("tren") ?? "").toUpperCase();
    return (["ALL", "TURUN", "NAIK"] as const).includes(raw as TrenFilter)
      ? (raw as TrenFilter) : "ALL";
  });
  const [selected, setSelected] = useState<DapRow | null>(null);

  // urutan kolom awal (dipakai F.R.I.D.A.Y, mis. “toko omset tertinggi”)
  const sortParam = (sp.get("urut") ?? "").trim();
  const initialSort = (DAP_SORT_KEYS as readonly string[]).includes(sortParam) ? sortParam : null;
  const initialDir = (sp.get("arah") ?? "").toLowerCase() === "asc" ? 1 : -1;

  const areas = useMemo(() => Array.from(new Set(all.map((r) => r.area).filter(Boolean))).sort(), [all]);
  // Filter wilayah yang tidak ada di sheet (mis. sisa perintah asisten) otomatis dianggap "ALL"
  const areaEff = area !== "ALL" && areas.length > 0 && !areas.includes(area) ? "ALL" : area;
  const kabs = useMemo(() => Array.from(new Set(all.filter((r) => areaEff === "ALL" || r.area === areaEff).map((r) => r.kabupaten).filter(Boolean))).sort(), [all, areaEff]);
  const kabEff = kab !== "ALL" && kabs.length > 0 && !kabs.includes(kab) ? "ALL" : kab;
  const kecs = useMemo(() => Array.from(new Set(all.filter((r) => (areaEff === "ALL" || r.area === areaEff) && (kabEff === "ALL" || r.kabupaten === kabEff)).map((r) => r.kecamatan).filter(Boolean))).sort(), [all, areaEff, kabEff]);
  const kecEff = kec !== "ALL" && kecs.length > 0 && !kecs.includes(kec) ? "ALL" : kec;

  // baris sebelum filter transaksi (dipakai untuk menghitung angka di chip filter)
  const baseRows = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((r) => {
      if (areaEff !== "ALL" && r.area !== areaEff) return false;
      if (kabEff !== "ALL" && r.kabupaten !== kabEff) return false;
      if (kecEff !== "ALL" && r.kecamatan !== kecEff) return false;
      if (terms.length === 0) return true;
      const hay = [r.toko, r.area, r.kabupaten, r.kecamatan, r.adm, r.kelasToko, r.kelasByr, r.status, r.bulanPasif]
        .join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [all, areaEff, kabEff, kecEff, q]);

  const segBase = useMemo(() => ringkasSegmentasi(baseRows, monthIdx), [baseRows, monthIdx]);
  const segTren = useMemo(() => ringkasTren(baseRows, monthIdx), [baseRows, monthIdx]);

  const rows = useMemo(() => {
    const byTrx = trx === "ALL" ? baseRows : baseRows.filter((r) => {
      const k = kategori(r, monthIdx);
      if (trx === "AKTIF") return k === "AKTIF";
      if (trx === "BAWAH") return diBawahTarget(r, monthIdx);
      return k !== "AKTIF" && (alasan === "ALL" || k === alasan);
    });
    return tren === "ALL" ? byTrx : byTrx.filter((r) => cocokTren(r, monthIdx, tren));
  }, [baseRows, trx, alasan, monthIdx, tren]);

  const seg = useMemo(() => ringkasSegmentasi(rows, monthIdx), [rows, monthIdx]);
  const lossMonthly = useMemo(() => hilangPerBulan(rows, monthIdx), [rows, monthIdx]);
  const lossKab = useMemo(() => hilangPerKabupaten(rows, monthIdx), [rows, monthIdx]);

  const totalToko = rows.length;
  const act = rows.reduce((s, r) => s + (r.bulanan[monthIdx] ?? 0), 0);
  const sumStoreTarget = rows.reduce((s, r) => s + r.targetToko, 0);
  const omset = rows.reduce((s, r) => s + r.omsetYtd, 0);

  // PCP memakai target resmi dari sheet Bulanan; saat filter toko aktif, pakai jumlah target toko terfilter
  const storeScoped = trx !== "ALL" || q.trim() !== "" || kecEff !== "ALL" || kabEff !== "ALL";
  const totalTarget = useMemo(() => {
    if (storeScoped) return sumStoreTarget;
    const mrows = monthly?.rows ?? [];
    const hit = mrows.find((r) => (areaEff === "ALL" ? r.area === "GLOBAL" : r.area === areaEff));
    return hit && hit.target > 0 ? hit.target : sumStoreTarget;
  }, [monthly, areaEff, storeScoped, sumStoreTarget]);
  const lossPct = totalTarget ? (seg.hilangNominal / totalTarget) * 100 : 0;

  const pcp = totalTarget ? (act / totalTarget) * 100 : 0;
  const badge = getBadge(pcp);
  const monthlyTotals = useMemo(() => MONTHS.map((_, i) => rows.reduce((s, r) => s + (r.bulanan[i] ?? 0), 0)), [rows]);

  const sAktif = selected ? selected.bulanan.filter((v) => v > 0).length : 0;
  const sAvg = selected ? selected.omsetYtd / (sAktif || 1) : 0;
  const sPcp = selected && selected.targetToko ? ((selected.bulanan[monthIdx] ?? 0) / selected.targetToko) * 100 : 0;
  const sKat = selected ? kategori(selected, monthIdx) : null;
  const sGap = selected ? (selected.bulanan[monthIdx] ?? 0) - selected.targetToko : 0;

  const trxItems = [
    { key: "ALL" as const, label: <>Semua {countChip(segBase.total)}</>, hint: "Tampilkan semua toko" },
    {
      key: "AKTIF" as const,
      label: <>{dot(KATEGORI.AKTIF.color)}Ada transaksi {countChip(segBase.perKategori.AKTIF.toko)}</>,
      hint: KATEGORI.AKTIF.desc,
    },
    {
      key: "BAWAH" as const,
      label: <>{dot("#fbbf24")}Di bawah target {countChip(segBase.bawahToko)}</>,
      hint: "Ada transaksi bulan ini, tapi realisasinya masih di bawah target toko",
    },
    {
      key: "TANPA" as const,
      label: <>{dot(KATEGORI.IDLE2.color)}Tanpa transaksi {countChip(segBase.tanpa.toko)}</>,
      hint: "Berhenti bulan ini, ≥ 2 bulan kosong, belum pernah transaksi, dan toko tutup",
    },
  ];
  const alasanItems = [
    { key: "ALL" as const, label: <>Semua alasan {countChip(segBase.tanpa.toko)}</> },
    ...URUTAN_TANPA.map((k) => ({
      key: k,
      label: <>{dot(KATEGORI[k].color)}{KATEGORI[k].short} {countChip(segBase.perKategori[k].toko)}</>,
      hint: KATEGORI[k].desc,
    })),
  ];

  return (
    <div className="space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold">DAP — Rincian Detail Toko</h1>
        <p className="text-sm text-slate-400">
          {isLoading ? "Memuat…" : `${rows.length === all.length ? all.length : `${rows.length} dari ${all.length}`} toko · Diperbarui ${new Date(data!.updatedAt).toLocaleString("id-ID")}`}
        </p>
      </div>

      <div className="space-y-2">
        <FilterBar>
          <FilterGroup label="Periode">
            <FilterSelect value={monthIdx} onChange={(v) => setMonthIdx(Number(v))} title="Bulan laporan">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </FilterSelect>
          </FilterGroup>
          <FilterGroup label="Wilayah">
            <FilterSelect value={areaEff} onChange={(v) => { setArea(v); setKab("ALL"); setKec("ALL"); }} title="Area">
              <option value="ALL">Semua Area</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </FilterSelect>
            <FilterSelect value={kabEff} onChange={(v) => { setKab(v); setKec("ALL"); }} title="Kabupaten">
              <option value="ALL">Semua Kabupaten</option>
              {kabs.map((k) => <option key={k} value={k}>{k}</option>)}
            </FilterSelect>
            <FilterSelect value={kecEff} onChange={setKec} title="Kecamatan">
              <option value="ALL">Semua Kecamatan</option>
              {kecs.map((k) => <option key={k} value={k}>{k}</option>)}
            </FilterSelect>
          </FilterGroup>
          <FilterGroup grow>
            <FilterSearch value={q} onChange={setQ} placeholder="🔍 Cari toko / ADM / status…" />
          </FilterGroup>
        </FilterBar>

        <FilterBar>
          <FilterGroup label="Transaksi">
            <FilterPills items={trxItems} value={trx} onChange={(k) => setTrx(k as TrxFilter)} id="dap-trx" size="sm" />
          </FilterGroup>
          {monthIdx > 0 && (
            <FilterGroup label="Tren">
              <FilterPills
                items={[
                  { key: "ALL" as const, label: <>Semua</>, hint: "Tanpa filter tren" },
                  { key: "TURUN" as const, label: <>{dot("#fb7185")}Turun {countChip(segTren.turun)}</>, hint: `Omset ${MONTHS[monthIdx]} lebih kecil dari ${MONTHS[monthIdx - 1]}` },
                  { key: "NAIK" as const, label: <>{dot("#34d399")}Naik {countChip(segTren.naik)}</>, hint: `Omset ${MONTHS[monthIdx]} lebih besar dari ${MONTHS[monthIdx - 1]}` },
                ]}
                value={tren} onChange={(k) => setTren(k as TrenFilter)} id="dap-tren" size="sm" />
            </FilterGroup>
          )}
          <AnimatePresence initial={false}>
            {trx === "TANPA" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="min-w-0">
                <FilterGroup label="Alasan">
                  <FilterPills items={alasanItems} value={alasan} onChange={(k) => setAlasan(k as AlasanFilter)} id="dap-alasan" size="sm" />
                </FilterGroup>
              </motion.div>
            )}
          </AnimatePresence>
        </FilterBar>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total Toko" delay={0} sub={`${seg.aktif.toko} ada transaksi · ${seg.tanpa.toko} tanpa transaksi`}>
          <CountUp value={totalToko} className="block text-3xl font-bold" />
        </Kpi>
        <Kpi label={`Total Act (${MONTHS[monthIdx]})`} delay={0.08}
          sub={`${seg.bawahToko} toko transaksi masih di bawah target (kurang ${rpShort(seg.bawahNominal)})`}>
          <CountUp value={act} format={rp} className="block text-3xl font-bold text-emerald-300" />
        </Kpi>
        <Kpi label="Total Target" delay={0.16}
          sub={storeScoped ? `${totalToko} toko terfilter` : `target resmi bulanan · ${totalToko} toko`}>
          <CountUp value={totalTarget} format={rp} className="block text-3xl font-bold" />
        </Kpi>
        <Kpi label="Pencapaian" delay={0.24}
          sub={storeScoped
            ? `target ${rpShort(seg.targetTotal)} dari ${totalToko} toko terfilter`
            : `Toko tanpa transaksi: ${seg.pctTokoTanpa.toFixed(1)}% dari total toko`}>
          <div className="flex items-center gap-2">
            <CountUp value={pcp} format={(v) => `${v.toFixed(1)}%`} className="text-3xl font-bold" />
            <Icn e={badge.emoji} className="h-3.5 w-3.5" />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pcp, 100)}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${badge.bg}, ${badge.color})` }} />
          </div>
        </Kpi>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-4 ${seg.hilangNominal > 0 ? "border-rose-400/25 bg-rose-500/[0.06]" : "border-amber-400/20 bg-amber-500/[0.05]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`text-sm uppercase tracking-wider ${seg.hilangNominal > 0 ? "text-rose-300" : "text-amber-300"}`}>
              {seg.hilangNominal > 0 ? `Nominal Hilang · ${MONTHS[monthIdx]}` : `Gap Target · ${MONTHS[monthIdx]}`}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <CountUp value={seg.hilangNominal > 0 ? seg.hilangNominal : seg.gapNominal} format={rp}
                className={`text-3xl font-bold ${seg.hilangNominal > 0 ? "text-rose-300" : "text-amber-300"}`} />
              <span className="text-sm text-slate-400">
                {seg.hilangNominal > 0
                  ? `${seg.hilangToko} toko · ${lossPct.toFixed(1)}% dari target ${rp(totalTarget)}`
                  : `${seg.targetTotal ? ((seg.gapNominal / seg.targetTotal) * 100).toFixed(1) : "0,0"}% target belum terealisasi`}
              </span>
            </div>
          </div>
          {seg.hilangNominal > 0 && (
            <p className="max-w-xs text-[0.8rem] leading-relaxed text-slate-500">
              Dihitung dari target toko yang sudah pernah transaksi lalu 0 di bulan terpilih.
              {seg.bukanKerugianToko > 0 && (
                <> {seg.perKategori.BELUM.toko} toko belum pernah transaksi dan {seg.perKategori.TUTUP.toko} toko tutup/DO NOT ORDER
                  (target {rpShort(seg.bukanKerugianNominal)}) tidak dihitung sebagai kerugian.</>
              )}
            </p>
          )}
        </div>

        {seg.hilangNominal > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(lossPct, 100)}%` }}
              transition={{ duration: 1.1, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400" />
          </div>
        )}

        {/* dari mana sisa gap target berasal — target − realisasi, bukan cuma toko 0 */}
        <div className={`mt-4 border-t pt-3 ${seg.hilangNominal > 0 ? "border-rose-400/15" : "border-amber-400/15"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[0.75rem] uppercase tracking-wider text-slate-400">Komposisi gap target</p>
            <p className="text-[0.8rem] text-slate-500">
              Target toko {rp(seg.targetTotal)} − realisasi {rp(seg.aktualTotal)} ={" "}
              <span className="font-semibold tabular-nums text-slate-300">{rp(seg.gapNominal)}</span>
            </p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <GapTile label="Hilang" toko={seg.hilangToko} tone="loss"
              sub={`target 0 transaksi · ${rpShort(seg.hilangNominal)}`}
              active={trx === "TANPA"}
              onClick={() => { setTrx("TANPA"); setAlasan("ALL"); }} />
            <GapTile label="Belum / tutup" toko={seg.bukanKerugianToko} tone="neutral"
              sub={`target ${rpShort(seg.bukanKerugianNominal)} · bukan kerugian`} />
            <GapTile label="Transaksi di bawah target" toko={seg.bawahToko} tone="under"
              sub={`kurang ${rpShort(seg.bawahNominal)}`}
              active={trx === "BAWAH"}
              onClick={() => setTrx("BAWAH")} />
            <GapTile label="≥ target" toko={seg.atasToko} tone="over"
              sub={`surplus ${rpShort(seg.atasNominal)}`} />
          </div>
          {seg.atasNominal > 0 && (
            <p className="mt-2 text-[0.75rem] leading-relaxed text-slate-500">
              Gap di atas sudah dikurangi surplus {rpShort(seg.atasNominal)} dari {seg.atasToko} toko yang melampaui target.
            </p>
          )}
        </div>

        {seg.tanpa.toko > 0 && (
          <div className="mt-4 border-t border-rose-400/15 pt-3">
            <p className="text-[0.75rem] uppercase tracking-wider text-slate-400">Rincian toko tanpa transaksi</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {URUTAN_TANPA.filter((k) => seg.perKategori[k].toko > 0).map((k) => (
                <button key={k} onClick={() => { setTrx("TANPA"); setAlasan(k); }}
                  title={`Klik untuk memfilter: ${KATEGORI[k].desc}`}
                  className={`rounded-xl border px-2.5 py-2 text-left transition-colors hover:bg-white/5 ${isKerugian(k) ? "border-rose-400/25 bg-rose-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                  <p className="flex items-center gap-1.5 text-[0.75rem] uppercase tracking-wide text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: KATEGORI[k].color }} />
                    {KATEGORI[k].short}
                  </p>
                  <p className="text-sm font-bold text-slate-100">{seg.perKategori[k].toko} toko</p>
                  <p className={`text-[0.75rem] ${isKerugian(k) ? "text-rose-300" : "text-slate-500"}`}>
                    {isKerugian(k) ? `hilang ${rpShort(seg.perKategori[k].target)}` : `target ${rpShort(seg.perKategori[k].target)} · bukan kerugian`}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm uppercase tracking-wider text-slate-400">Omset per Bulan (Jan–Des)</p>
          <p className="text-[0.8rem] text-slate-500">Blok penuh = aktual · blok garis = target toko yang tidak transaksi di bulan itu</p>
        </div>
        <DapChart values={monthlyTotals} loss={lossMonthly} selectedMonth={monthIdx} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm uppercase tracking-wider text-slate-400">Komposisi Toko · {MONTHS[monthIdx]}</p>
            <p className="text-[0.8rem] text-slate-500">{seg.tanpa.toko} toko tanpa transaksi ({seg.pctTokoTanpa.toFixed(1)}%)</p>
          </div>
          <KomposisiToko ringkas={seg} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm uppercase tracking-wider text-slate-400">Top 8 Kabupaten · Nominal Hilang</p>
            <p className="text-[0.8rem] text-slate-500">{seg.hilangToko} toko · {rpShort(seg.hilangNominal)}</p>
          </div>
          {lossKab.length > 0 ? (
            <HilangPerKabupaten data={lossKab} />
          ) : (
            <div className="flex h-64 items-center justify-center text-center text-sm text-slate-500">
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
              <p className="text-sm text-slate-400">
                {selected.area} · {selected.kabupaten} · {selected.kecamatan} · ADM {selected.adm || "-"} · {selected.kelasToko || "-"}/{selected.kelasByr || "-"} · {selected.status}
              </p>
            </div>
            <button onClick={() => setSelected(null)}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200">✕ Tutup</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <Chip label="Omset YTD" value={rp(selected.omsetYtd)} accent="text-emerald-300" />
            <Chip label="Target/bulan" value={rp(selected.targetToko)} />
            <Chip label="Bulan aktif" value={`${sAktif} bln`} />
            <Chip label="Rata-rata/bln" value={rp(sAvg)} />
            <Chip label={`PCP ${MONTHS[monthIdx]}`}
              value={sPcp > 0 ? `${sPcp.toFixed(0)}%` : "—"}
              accent={sPcp >= 100 ? "text-emerald-300" : sPcp >= 85 ? "text-yellow-300" : "text-orange-300"} />
            <Chip label="Gap bln ini"
              value={!selected.targetToko ? "—" : sGap < 0 ? `−${rpShort(-sGap)}` : `+${rpShort(sGap)}`}
              accent={sGap < 0 ? "text-amber-300" : "text-emerald-300"} />
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
        onSelect={setSelected} selectedToko={selected?.toko ?? null}
        initialSort={initialSort} initialDir={initialDir} />
    </div>
  );
}

/** key = query string, supaya perintah asisten berikutnya langsung menerapkan filter baru */
function DapPageWithParams() {
  const sp = useSearchParams();
  return <DapPageContent key={sp.toString()} />;
}

export default function DapPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Memuat…</div>}>
      <DapPageWithParams />
    </Suspense>
  );
}
