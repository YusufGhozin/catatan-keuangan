# Ruang Keuangan — Aplikasi Keuangan Pribadi

Aplikasi web sederhana untuk mencatat pemasukan dan pengeluaran, melihat rekap bulanan/tahunan, serta mengelola riwayat transaksi.

## Teknologi yang digunakan

- **Frontend:** HTML, CSS, dan JavaScript (tanpa proses build dan tanpa instalasi Node.js).
- **Database:** Supabase PostgreSQL.
- **Login:** Supabase Auth (email dan kata sandi).
- **Hosting aplikasi:** GitHub Pages.
- **Keamanan data:** Row Level Security (RLS) di PostgreSQL.

GitHub Pages hanya menyajikan file aplikasi. Data transaksi tidak disimpan di GitHub; data disimpan di database Supabase.

## Fitur

- Daftar akun dan masuk menggunakan email.
- Catat, ubah, dan hapus transaksi.
- Jenis transaksi: pemasukan dan pengeluaran.
- Metode pembayaran: tunai, transfer, kartu debit, kartu kredit, QRIS, e-wallet, dan lainnya.
- Kategori dapat dipilih atau diketik sendiri.
- Filter berdasarkan tahun dan bulan, termasuk melihat semua bulan dalam satu tahun.
- Hitung otomatis total pemasukan, pengeluaran, saldo bersih, jumlah transaksi, dan pengeluaran per kategori.
- Grafik perbandingan arus kas per bulan.
- Cari transaksi dan filter jenis transaksi.
- Ekspor riwayat terfilter ke CSV (bisa dibuka dengan Excel).
- Ekspor dan impor cadangan seluruh transaksi dalam format JSON.
- Tampilan responsif untuk laptop dan ponsel.

## 1. Buat database Supabase

1. Buka [https://supabase.com](https://supabase.com), buat akun, lalu buat **New project**.
2. Pilih nama project, password database yang kuat, dan region terdekat yang tersedia.
3. Setelah project siap, buka menu **SQL Editor**.
4. Pilih **New query**.
5. Buka file `supabase/schema.sql` dari folder proyek ini, salin seluruh isinya, tempel ke SQL Editor, lalu tekan **Run**.
6. Pastikan query selesai tanpa error. Script ini membuat tabel transaksi, membatasi hak akses tabel, dan memasang aturan keamanan RLS.

> Jangan menghapus atau menonaktifkan RLS pada tabel `transactions`. RLS adalah lapisan penting yang memastikan pengguna hanya bisa mengakses transaksi dengan `user_id` miliknya sendiri.

## 2. Ambil URL dan anon key Supabase

1. Di Supabase Dashboard, buka **Project Settings**.
2. Buka bagian **API** (pada tampilan baru, informasi ini dapat muncul di bagian API Keys).
3. Salin **Project URL**.
4. Salin **anon / public key**. Pada dashboard yang lebih baru namanya dapat ditampilkan sebagai publishable key.
5. Buka file `config.js` pada proyek ini.
6. Ganti nilai contoh berikut dengan data project Anda:

```js
export const SUPABASE_URL = 'https://PROJECT-ANDA.supabase.co';
export const SUPABASE_ANON_KEY = 'ANON-ATAU-PUBLISHABLE-KEY-ANDA';
```

**Penting:** hanya gunakan anon/public/publishable key di frontend. Jangan pernah memasukkan `service_role` key atau secret key ke `config.js`, GitHub, atau file frontend lainnya. Kunci publik memang terlihat oleh pengunjung website; keamanan data dijaga oleh autentikasi dan RLS.

## 3. Atur autentikasi email

1. Di Supabase, buka **Authentication** lalu **Providers**.
2. Pastikan provider **Email** aktif.
3. Buka **Authentication > URL Configuration**.
4. Untuk pengujian lokal, tambahkan URL lokal ke daftar **Redirect URLs**, misalnya `http://127.0.0.1:5500/**`.
5. Setelah GitHub Pages aktif, tambahkan juga alamat website GitHub Pages Anda, misalnya `https://USERNAME.github.io/NAMA-REPO/**`.
6. Atur **Site URL** ke alamat website utama yang paling sering digunakan. Saat tahap awal, Site URL bisa diisi URL GitHub Pages setelah website diterbitkan.

Jika konfirmasi email diaktifkan, setelah membuat akun periksa inbox/spam dan klik tautan konfirmasi sebelum masuk. Untuk keamanan, sebaiknya tetap gunakan konfirmasi email.

## 4. Jalankan di VS Code

1. Ekstrak file ZIP proyek ini ke folder yang mudah ditemukan.
2. Buka VS Code.
3. Pilih **File > Open Folder**, lalu pilih folder `keuangan-pribadi`.
4. Pastikan file `config.js` sudah diisi.
5. Pasang ekstensi **Live Server** di VS Code (oleh Ritwick Dey) jika belum ada.
6. Klik kanan file `index.html`, lalu pilih **Open with Live Server**.
7. Website akan terbuka di browser, biasanya pada alamat seperti `http://127.0.0.1:5500`.
8. Pilih **Buat akun**, daftar dengan email dan kata sandi, lalu ikuti konfirmasi email jika diminta.

Jangan membuka `index.html` dengan klik dua kali (`file://`). Jalankan menggunakan Live Server atau hosting web karena aplikasi menggunakan JavaScript module.

## 5. Hosting di GitHub Pages

1. Buat repository baru di GitHub, misalnya `ruang-keuangan`.
2. Upload seluruh isi folder proyek ke repository. Pastikan `index.html` berada di root repository, bukan di dalam folder tambahan.
3. Buka repository **Settings > Pages**.
4. Di bagian **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`, lalu tekan **Save**.
6. Tunggu proses publikasi GitHub Pages selesai. Buka alamat yang diberikan GitHub.
7. Kembali ke Supabase **Authentication > URL Configuration**, tambahkan alamat GitHub Pages Anda ke **Redirect URLs**, lalu simpan.
8. Coba masuk melalui alamat GitHub Pages.

Bila repository Anda bernama `USERNAME.github.io`, alamatnya biasanya `https://USERNAME.github.io/`. Bila nama repository berbeda, alamatnya biasanya `https://USERNAME.github.io/NAMA-REPO/`.

## Cara menggunakan aplikasi

1. Masuk menggunakan akun yang sudah dibuat.
2. Pilih tahun dan bulan di bagian kanan atas. Pilih **Semua bulan** untuk rekap satu tahun penuh.
3. Tekan **Tambah transaksi**.
4. Pilih **Pemasukan** atau **Pengeluaran**, masukkan nominal, tanggal, kategori, dan metode pembayaran.
5. Tekan **Simpan transaksi**. Ringkasan, grafik, kategori, dan daftar transaksi akan diperbarui otomatis.
6. Untuk melihat data lama, ganti filter tahun. Data tidak perlu dibuat ulang.
7. Gunakan tombol **Ekspor CSV** untuk membuka transaksi yang sedang terfilter di Excel.
8. Gunakan **Cadangkan data** secara berkala untuk mengunduh seluruh transaksi sebagai JSON. Simpan file cadangan di tempat pribadi.
9. Untuk mengembalikan data dari cadangan, pilih **Pulihkan data**. Transaksi akan ditambahkan, bukan menggantikan data yang sudah ada.

## Memahami debit, kredit, pemasukan, dan pengeluaran

Di aplikasi ini, **Pemasukan/Pengeluaran** adalah jenis transaksi yang menentukan perhitungan ringkasan. **Kartu Debit/Kartu Kredit** adalah metode pembayaran. Contoh: membeli makan Rp35.000 menggunakan kartu debit dicatat sebagai **Pengeluaran** dengan metode **Kartu Debit**. Pembelian menggunakan kartu kredit juga dicatat sebagai pengeluaran saat transaksi terjadi. Ketika tagihan kartu kredit dibayar, jangan masukkan pembayaran itu lagi sebagai pengeluaran bila pembelian-pembeliannya sudah dicatat, karena akan terjadi hitung ganda.

Aplikasi versi ini belum memisahkan transfer antar rekening sebagai jenis transaksi khusus dan belum menghitung saldo rekening berdasarkan mutasi. Fokusnya adalah rekap pemasukan dan pengeluaran pribadi.

## Catatan keamanan dan penggunaan

- Jangan bagikan akun email dan kata sandi Supabase Anda.
- Jangan pernah mengunggah `service_role` key atau password database ke GitHub.
- Jangan menaruh file cadangan JSON/CSV yang berisi data transaksi di repository publik.
- `config.js` berisi URL project dan anon/public key. Keduanya bukan password; aturan RLS tetap wajib aktif dan hak akses tabel harus tetap dibatasi seperti pada `supabase/schema.sql`.
- Gunakan kata sandi yang kuat dan aktifkan keamanan akun email Anda.
- Simpan cadangan JSON secara berkala. Database online bukan pengganti backup pribadi.
- Aplikasi ini merupakan pencatat transaksi, bukan aplikasi perbankan dan tidak terhubung otomatis ke rekening bank.

## Struktur folder

```text
keuangan-pribadi/
├── index.html
├── styles.css
├── app.js
├── config.js
├── README.md
└── supabase/
    └── schema.sql
```
