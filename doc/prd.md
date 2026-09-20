# Product Requirements Document
# QRCC Data Center — Web Application

**Version:** 0.0.1  
**Tanggal:** September 2026  
**Stack:** Nuxt 4 · Nuxt UI · SQLite · Drizzle ORM · TypeScript  
**Dibuat untuk:** QRCC — Data Center (Single-user, Admin/Personal)

---

## 1. Latar Belakang & Tujuan

### 1.1 Masalah Saat Ini
Pencatatan dan pelacakan data klaim kualitas pasar, sampel komponen rusak, serta pengarsipan technical report secara manual/terpisah membuat pencarian histori dan monitoring progres harian menjadi tidak efisien.

### 1.2 Tujuan Produk
Membangun web aplikasi pribadi yang terpusat dan aman (dilindungi autentikasi better-auth) sebagai single source of truth untuk mempermudah pencatatan, pemantauan progres (klaim & sampel defect), serta pengarsipan technical report / service tips dari QRCC.

### 1.3 Sasaran Pengguna
Single-user (Admin/Personal) untuk pemakaian operasional harian.

---

## 2. Ruang Lingkup (Scope)

### 2.1 Dalam Scope (MVP)
- ✅ Autentikasi Aman: Sistem login privat menggunakan better-auth.
- ✅ Dashboard KPI & Statistik: Visualisasi ringkasan data (misal: total klaim bulan ini, rasio status open/closed, dan tren sampel defect).
- ✅ Manajemen Market Quality Claims (CRUD): Tabel data pencatatan klaim kualitas dari pasar dengan fitur filter dan pencarian.
- ✅ Manajemen Sample Defect Log: Pencatatan dan pelacakan progres fisik sampel komponen yang rusak.
- ✅ Manajemen Technical Report / Service Tips: Modul penyimpanan dan pencatatan laporan teknis yang dirilis oleh QRCC.
- ✅ Sistem Attachment File/Foto: Kemampuan mengunggah foto bukti defect dan dokumen PDF/Word untuk melengkapi data klaim dan laporan.

### 2.2 Luar Scope (Future Release)
- ❌ Manajemen role pengguna yang kompleks (karena sifatnya single-user).
- ❌ Notifikasi otomatis (email/sistem pihak ketiga).
- ❌ Mobile app native
- ❌ Multi-bahasa (i18n)
- ❌ Integrasi ke sistem eksternal perusahaan (ERP).

---

## 3. User Stories


- US-01 (Klaim Baru) : Sebagai pengguna, saya dapat membuat entri quality issue baru dengan detail lengkap beserta lampiran (foto/file/video), agar masalah baru langsung terdokumentasi.

- US-02 (Update Klaim): Sebagai pengguna, saya dapat memilih quality issue yang sudah ada untuk menambahkan catatan progress dan melampirkan media tambahan, agar riwayat penanganan terekam urut.

- US-03 (Sample Terkait): Sebagai pengguna, saya dapat mencatat sample defect baru dan memasukkan ID quality issue sebagai referensi silang (cross-reference), agar pergerakan barang fisik selaras dengan laporan klaim.

- US-04 (Sample Independen): Sebagai pengguna, saya dapat mencatat sample defect tanpa mengaitkannya dengan klaim apa pun, untuk mengakomodasi pengujian acak atau isu lampau.

- US-05 (Technical Report/Service Tips): Sebagai pengguna, saya dapat mengunggah dan mendata Technical Report atau Service Tips yang dirilis oleh QRCC, agar memiliki arsip digital yang mudah dicari. bisa standalone juga dikaitkan dengan id quality issue tertentu

- US-06 (Dashboard): Sebagai pengguna, saya dapat melihat ringkasan status operasional harian di dashboard setelah login, agar bisa langsung menentukan prioritas pekerjaan hari itu.

---

## 4. Pertimbangan

### 4.1 Teknis

| Kategori | Kebutuhan |
|---|---|
| **Performa** | Halaman utama load < 2 detik; tabel dengan 1000+ baris tetap responsif |
| **Keamanan** | Password di-hash (bcrypt via Better-auth); session expire setelah 8 jam; input sanitization |
| **Keandalan** | SQLite dengan WAL mode; auto-backup harian ke file lokal |
| **Aksesibilitas** | Bisa diakses via browser modern (Chrome, Firefox, Edge) |
| **Responsivitas** | UI responsif untuk desktop dan tablet (min 768px) |
| **Maintainability** | TypeScript strict mode; komponen modular; Drizzle migration untuk schema |
| **File Storage** | Attachment disimpan lokal di server (`/uploads`); validasi tipe file (jpg, png, pdf, docx) dan ukuran maksimal 10MB per file |

### 4.2 Non-Teknis

- Lingkungan Eksekusi: Aplikasi berjalan murni secara lokal (localhost), menghilangkan kompleksitas deployment, hosting, dan latensi jaringan.

- Manajemen & Limitasi File:

       Video: Batas maksimal 10 MB per unggahan.

       Foto, Dokumen, dan PDF: Batas maksimal 1 MB per unggahan.

       Media akan disimpan langsung pada sistem file lokal (misal: direktori /public/uploads).

- Keamanan Data: Meskipun beroperasi secara offline di mesin pribadi, akses tetap dikunci menggunakan password hashing dari better-auth untuk mencegah manipulasi data secara tidak sengaja.

- Keandalan: Backup database berupa penyalinan file .sqlite secara berkala sangat disarankan karena data tidak tersinkronisasi ke cloud.
---

## 5. Tech Stack

- Frontend    : Nuxt 4 (Vue 3 + Composition API)
- UI Library  : Nuxt UI (berbasis Tailwind CSS + Headless UI)
- Language    : TypeScript (strict)
- Database    : SQLite (file-based, lokal)
- ORM         : Drizzle ORM
- Server      : Nuxt server routes (Nitro)
- Auth        : Better-auth
- Export      : xlsx (SheetJS) untuk export Excel
- PDF         : pdfmake / puppeteer untuk export PDF ringkasan claim
- Storage     : File system lokal (/uploads) untuk attachment


## 6. Code Style Guidelines

- **Formatting**: 2-space indentation, LF line endings, no trailing whitespace
- **Vue Components**: Use `<script setup lang="ts">` with Composition API
- **Imports**: Relative imports only - Vue/Nuxt → third-party → local
- **Database**: Drizzle ORM with SQLite, schemas in `/server/database/schema/`
- **Validation**: Gunakan Zod schema validation yang tepat untuk setiap tipe API route http request (Runtime + Type-Safe Request Utils)
- **Error Handling**: `createError()` with proper status codes in try/catch blocks
- **File Naming**: PascalCase for components, camelCase for utils/composables
- **Testing**: Vitest dengan `.test.ts` atau `.spec.ts` suffixes

## 7. Separation of Concerns

| Layer      | Tanggung Jawab                   | Tidak Boleh                   | Folder                         |
| ---------- | -------------------------------- | ----------------------------- | ------------------------------ |
| API Route  | HTTP, Auth, Validasi input dasar | Business logic, Query DB      | `server/api/*`                 |
| Service    | Business logic, Koordinasi       | Query DB langsung, HTTP stuff | `server/services/*.service.ts` |
| Repository | CRUD database                    | Business logic, Auth          | `server/repositories/*.repo.ts`|
---