# PCP Evolution — Implementasi UI/UX

Versi ini dibangun ulang dari arsip proyek PCP Dashboard asli yang diberikan pengguna, bukan dari paket PCP-Evolution sebelumnya.

## Fokus perubahan

Revisi ini berangkat dari PCP Evolution yang disetujui pengguna. Fokus tambahan adalah memperbaiki ruang kerja modul yang sebelumnya masih terasa sempit, bukan mengganti identitas desain atau menulis ulang logika bisnis.

- **Lebar aplikasi:** area konten utama sekarang menggunakan lebar yang tersedia (`w-full`, tanpa batas `max-width` tetap). Ruang kiri tetap mengikuti lebar sidebar melalui `--side-w`; padding layar dibuat adaptif.
- **DAP:** filter ditempatkan sebagai satu area kontrol, KPI dibuat responsif, panel nominal hilang/komposisi gap diberi hierarki visual, dan area grafik/rincian menggunakan lebar konten penuh. Filter, segmentasi, perhitungan, detail toko, grafik, sorting, dan tabel tidak dihapus.
- **Produk:** area filter dibuat menjadi grid adaptif, KPI dan kontrol grafik mendapat panel konsisten, grafik dan tabel memanfaatkan lebar yang tersedia. Filter bulan/tanggal/area/kategori/brand/toko, menu grafik, tren, ranking, pagination, dan tabel tetap ada.
- **Catatan:** daftar catatan dan editor diperlakukan sebagai workspace dua kolom dengan lebar editor fleksibel. Toolbar, autosave lokal, dan format isi tetap dipertahankan.
- **Pengguna:** form tambah akun dan tabel administrasi diselaraskan dengan token tema PCP; tabel tetap bisa digulir pada layar sempit. Tambah/edit/hapus akun dan pengaturan akses tidak diubah.
- **Responsif:** breakpoint desktop, tablet, dan ponsel ditata ulang agar grid tidak memaksa lebar tetap dan elemen data tidak saling menindih.
- **Tema:** identitas charcoal/lime serta light/dark mode tetap menggunakan token tema yang sudah ada.

Tidak ada perubahan pada perhitungan bisnis, `src/lib/`, API route, autentikasi, Supabase, permission, atau struktur data.

## File yang berubah dibanding ZIP PCP Evolution yang diunggah

1. `src/app/globals.css` — sistem lebar fluid dan styling spesifik keempat modul.
2. `src/components/ShellMain.tsx` — kanvas utama tidak lagi dibatasi `max-width` tetap.
3. `src/app/dap/page.tsx` — hook class layout untuk filter, KPI, gap, grafik, dan detail.
4. `src/app/produk/page.tsx` — hook class layout untuk filter, KPI, kontrol grafik, dan tabel.
5. `src/app/catatan/page.tsx` — hook class untuk workspace daftar/editor.
6. `src/app/pengguna/page.tsx` — hook class untuk form dan tabel administrasi.
7. `PCP-EVOLUTION-IMPLEMENTATION.md` — catatan perubahan dan hasil validasi revisi.

Semua perubahan di halaman adalah class/layout; tidak ada handler data atau rumus bisnis yang diubah.

## Menjalankan secara lokal

1. Ekstrak folder proyek.
2. Siapkan `.env.local` secara lokal dari Vercel Development Environment. Jangan commit file ini.
3. Jalankan `npm ci` (atau `npm install` jika diperlukan).
4. Jalankan `npm run dev`.
5. Buka `http://localhost:3000`.

## Catatan validasi

- `src/app/globals.css` berhasil diparse oleh PostCSS (409 aturan CSS).
- Pemeriksaan TypeScript tidak menemukan diagnostic sintaks TS/TSX. Pemeriksaan tipe penuh tidak dapat dinyatakan lulus karena dependensi proyek (`next`, `react`, dan lainnya) belum terpasang di lingkungan penyusunan.
- `npm ci --ignore-scripts --no-audit --no-fund` mengalami timeout saat mengunduh dependensi. Karena itu `next build` belum dapat dijalankan dan belum boleh dianggap lulus.
- Jalankan `npm ci` lalu `npm run build` di komputer lokal sebelum deploy.
- Arsip ini tidak menyertakan `.env.local`, token, atau kredensial.
