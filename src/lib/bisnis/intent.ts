/**
 * Penentu jalur pertanyaan (aman dipakai di klien).
 * Perintah navigasi lama ("buka…", "liat…") tetap ke parser F.R.I.D.A.Y lama;
 * pertanyaan analisis / rekomendasi / lanjutan percakapan ke Analis.
 */
const NAV = /^(tolong\s+)?(buka|bukain|bukakan|liat|lihat|lihatin|tampilkan|tunjukkan|tunjukin|pindah|ke halaman|cek)\b/i;

const KUAT = [
  /rekomendasi|rekomendasikan|tawarkan|tawarin|ditawarkan|strategi|saran produk/,
  /penyebab|kenapa|mengapa|\bknp\b|faktor/,
  /bandingkan|dibanding|\bvs\b|perbandingan|minggu lalu/,
  /naik daun|produk baru|berhenti (dibeli|beli)|jarang dibeli|belum (dibeli|membeli|beli)|berpotensi|potensial|pelengkap|paling lambat|tren produk|trend produk/,
  /\bberapa\b.*\b(omz?et|omset)\b/,
  /\b(omz?et|omset)\b.*\b(minggu ini|minggu lalu|bulan ini|bulan lalu)\b/,
  /\b(produk|toko)\b.*\b(naik|turun|menurun|meningkat)\b.*\b(minggu|bulan)\b/,
];

/** Petunjuk pertanyaan lanjutan yang mengandalkan konteks sebelumnya. */
const LANJUTAN = /\b(toko|produk)\s+(itu|tersebut|tadi)\b|\bnya\b|\byang tadi\b|\bpenyebab|\bkenapa|\bmengapa|\btawarkan|\brekomendasi|\bstrategi|\btoko mana\b|\bproduk apa\b|\bpaling (turun|naik)\b/;

export function perluAnalis(text: string, adaKonteks: boolean): boolean {
  const t = text.toLowerCase().trim();
  if (!t) return false;
  const nav = NAV.test(t);
  if (KUAT.some((re) => re.test(t))) {
    // "buka ... rekomendasi" tetap analisis, tapi "buka penjualan yang turun bulan ini" navigasi
    return !nav || /rekomendasi|tawarkan|strategi|penyebab|kenapa|bandingkan/.test(t);
  }
  if (nav) return false;
  return adaKonteks && LANJUTAN.test(t);
}
