# PCP Evolution — Implementasi UI/UX

Versi ini dibangun ulang dari arsip proyek PCP Dashboard asli yang diberikan pengguna, bukan dari paket PCP-Evolution sebelumnya.

## Fokus perubahan

- Beranda: panel performance insight berbasis capaian aktual dan kutipan motivasi yang berganti otomatis; kartu utama dan akses cepat diberi hierarki yang lebih kuat.
- Pencapaian Bulanan: ringkasan performa utama, empat indikator dengan progress visual, perbandingan area, dan matriks rincian Penjualan/Trip/Kontribusi/Hari Efektif. PotionGauge tidak dipakai pada halaman ini, tetapi file komponennya tetap disimpan.
- Pencapaian Mingguan: KPI diperbesar, grafik aktual per minggu dan grafik akumulasi ditampilkan berdampingan, tabel tetap tersedia. Kontrol tampilan grafik tetap aktif.
- DAP: seluruh filter, filter lanjutan, KPI, grafik tren, komposisi, rincian kabupaten, detail toko, dan tabel dipertahankan; visual panel, filter, tabel, dan keterbacaan ditingkatkan.
- Produk: semua filter cascading, filter tanggal, menu multi-grafik, tren harian/bulanan/per-produk, ranking, dan tabel tetap dipertahankan; komposisi filter, KPI, panel grafik, dan tabel diberi sistem visual baru.
- Catatan: editor dan penyimpanan otomatis tetap; daftar catatan dan area editor diperjelas.
- Pengguna: alur tambah/edit/hapus user dan hak akses tetap; form dan tabel administrasi diperbarui.
- Sistem tema: token desain PCP charcoal/lime dan light/dark mode tetap dipakai; aturan responsif ditambahkan.

## File yang berubah dibanding proyek asli

1. `src/app/globals.css`
2. `src/app/page.tsx`
3. `src/app/bulanan/page.tsx`
4. `src/app/mingguan/page.tsx`
5. `src/app/dap/page.tsx`
6. `src/app/produk/page.tsx`
7. `src/app/catatan/page.tsx`
8. `src/app/pengguna/page.tsx`
9. `src/components/MatrixChart.tsx`
10. `src/features/weekly/WeeklyChart.tsx`

Tidak ada file pada `src/lib/`, API route, autentikasi, Supabase, atau hak akses yang diubah. `package.json` dan `package-lock.json` tetap dari proyek asli.

## Menjalankan secara lokal

1. Ekstrak folder proyek.
2. Siapkan `.env.local` secara lokal dari Vercel Development Environment. Jangan commit file ini.
3. Jalankan `npm ci` (atau `npm install` jika diperlukan).
4. Jalankan `npm run dev`.
5. Buka `http://localhost:3000`.

## Catatan validasi

- Seluruh 82 file TypeScript/TSX berhasil diparse oleh TypeScript `transpileModule` tanpa diagnostic sintaks.
- Perbandingan hash terhadap arsip asli menunjukkan tepat 10 file di atas berubah; file `src/lib/`, API, autentikasi, dan konfigurasi dependensi tidak berubah.
- `npm ci` dan `npm install` tidak selesai pada lingkungan penyusunan karena timeout pengunduhan dependensi. Karena itu production build belum dapat diklaim lulus. Jalankan `npm run build` pada mesin lokal setelah dependensi terpasang.
- Tidak ada `.env.local`, token, atau kredensial yang disertakan dalam arsip.
