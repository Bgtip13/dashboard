export const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

/** Format pendek: tidak ada "1000jt" / "1000rb" — otomatis naik satuan (950rb→1jt, 950jt→1M) */
export function rpShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 950_000_000) return "Rp" + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (a >= 950_000) return "Rp" + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  if (a >= 1_000) return "Rp" + Math.round(n / 1e3).toLocaleString("id-ID") + " rb";
  return "Rp" + n.toLocaleString("id-ID");
}

/** Hari efektif otomatis: semua tanggal bulan berjalan kecuali Minggu */
export function hariEfektif(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  const lastDay = new Date(y, m + 1, 0).getDate();
  let total = 0, berjalan = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(y, m, d).getDay() === 0) continue; // skip Minggu
    total++;
    if (d <= today) berjalan++;
  }
  return { total, berjalan };
}
