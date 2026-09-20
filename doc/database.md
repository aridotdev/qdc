# backend.md
# Arsitektur Backend - QRCC Data Center

## 1. Struktur Database
Database menggunakan SQLite dengan Drizzle ORM[cite: 1]. Berdasarkan kebutuhan *single source of truth* dan relasi antar data, berikut adalah pembahasan struktur tabelnya satu per satu:

*   **Tabel `users` & `sessions` (Autentikasi)**
    Tabel ini diwajibkan oleh ekosistem `better-auth`[cite: 1]. `users` akan menyimpan informasi kredensial admin tunggal (seperti email dan password hash bcrypt), sedangkan `sessions` mengelola sesi login yang aktif dengan waktu kedaluwarsa (8 jam)[cite: 1].
*   **Tabel `quality_issues` (Klaim Kualitas Pasar)**
    Merupakan tabel utama untuk menyimpan data awal klaim (US-01)[cite: 1]. Field yang dibutuhkan mencakup ID (primary key), judul masalah, deskripsi, tanggal kejadian, prioritas, serta status penanganan (misalnya: *Open*, *In Progress*, *Closed*).
*   **Tabel `issue_progress_logs` (Riwayat Update Klaim)**
    Tabel ini menyimpan setiap pembaruan catatan pada suatu klaim (US-02)[cite: 1]. Berelasi *Many-to-One* ke tabel `quality_issues`. Ini memastikan riwayat penanganan terekam secara kronologis tanpa menimpa deskripsi awal klaim.
*   **Tabel `sample_defects` (Log Sampel)**
    Menyimpan data fisik sampel komponen rusak[cite: 1]. Memiliki foreign key opsional ke `quality_issues` (karena bisa terhubung ke klaim (US-03) atau independen (US-04)[cite: 1]). Field meliputi nama part, nomor part, kondisi saat diterima, dan tanggal penerimaan.
*   **Tabel `technical_reports` (Arsip Laporan)**
    Menyimpan arsip dokumen rilis (Technical Report/Service Tips) (US-05)[cite: 1]. Tabel ini juga memiliki foreign key opsional ke `quality_issues` agar bisa berdiri sendiri atau terikat pada kasus tertentu[cite: 1].
*   **Tabel `attachments` (Manajemen Media)**
    Karena media (foto, video, pdf, docx) dapat menempel pada pembuatan klaim baru, progres, maupun arsip[cite: 1], tabel ini digunakan secara terpusat untuk menyimpan metadata file (path lokal `/uploads`, tipe file, ukuran)[cite: 1]. Tabel ini dapat menggunakan pendekatan polimorfik (menyimpan tipe referensi tabel dan ID entitas) agar lebih fleksibel.

---

## 2. Struktur API
Sesuai pedoman *Separation of Concerns*, API akan dikelola oleh Nuxt Server Routes (Nitro) dan divalidasi ketat menggunakan Zod sebelum diteruskan ke *Service Layer* dan *Repository*[cite: 1]. 

*   **Auth Routes (`/api/auth/*`)**
    Ditangani secara otomatis oleh `better-auth` untuk proses `sign-in`, `sign-out`, dan validasi sesi[cite: 1].
*   **Dashboard API (`/api/dashboard/stats`)**
    Endpoint `GET` untuk menarik agregasi data dari berbagai tabel (total klaim, rasio status, tren sampel) guna ditampilkan pada layar utama (US-06)[cite: 1].
*   **Quality Issues API (`/api/issues`)**
    Endpoint CRUD standar. Mencakup `GET` untuk *listing* beserta filter pencarian, `POST` untuk membuat klaim, serta endpoint spesifik seperti `POST /api/issues/:id/progress` untuk menambahkan riwayat log[cite: 1].
*   **Sample Defects API (`/api/samples`)**
    Endpoint CRUD untuk mengelola pencatatan sampel fisik. Menerima payload ID referensi klaim jika sampel tersebut terkait dengan masalah pasar[cite: 1].
*   **Technical Reports API (`/api/reports`)**
    Endpoint CRUD untuk mengelola arsip laporan. 
*   **Upload API (`/api/upload`)**
    Endpoint tunggal berjenis `POST` (multipart/form-data) untuk memproses unggahan file[cite: 1]. Endpoint ini akan melakukan validasi ukuran file (Video max 10MB, Dokumen max 1MB)[cite: 1] serta tipe file, lalu menyimpan ke sistem file lokal, dan mengembalikan string URL/Path ke klien.

---

## 3. Alur Autentikasi (Authentication Flow)
1. **Inisiasi Klien**: Pengguna membuka aplikasi di browser lokal[cite: 1]. Middleware Nuxt memeriksa keberadaan kuki sesi valid. Jika tidak ada, pengguna diarahkan ke halaman login.
2. **Proses Login**: Klien mengirim email dan password ke `/api/auth/sign-in`.
3. **Validasi Server**: `better-auth` memvalidasi kredensial (mencocokkan *hash* password)[cite: 1]. 
4. **Pembentukan Sesi**: Jika valid, entri baru dicatat di tabel `sessions` dengan *expiry time* 8 jam[cite: 1]. Server mengembalikan respon dengan *HttpOnly cookie* sebagai token keamanan.
5. **Akses Data**: Untuk setiap akses ke API operasional (seperti mengambil atau menambah data klaim), Nitro API Route akan memeriksa validitas *cookie*. Jika tidak sah, API mengembalikan status 401 Unauthorized, menolak eksekusi *Layer Service*.

---

## 4. Alur Data (Data Flow)
Berikut adalah alur data standar berdasarkan aturan isolasi tanggung jawab (Layered Architecture)[cite: 1]:

1. **Permintaan Klien**: Antarmuka Nuxt UI mengirim request HTTP (misal: `POST /api/issues` berserta data formulir dan ID foto yang sudah diunggah)[cite: 1].
2. **Layer API Route (`server/api/*`)**: Endpoint menerima payload. Ia melakukan dua hal utama: memastikan kuki sesi valid dan menjalankan validasi struktur/tipe data dengan skema Zod (misal memastikan judul tidak kosong dan ukuran ID valid)[cite: 1]. Tidak ada kueri database pada tahap ini.
3. **Layer Service (`server/services/*`)**: Jika validasi API lulus, data diteruskan ke Service. Di sini aturan bisnis berjalan (misal: jika membuat klaim baru berstatus darurat, pastikan prioritasnya diatur dengan benar, atau mengumpulkan data terstruktur).
4. **Layer Repository (`server/repositories/*`)**: Service memanggil Repository yang bertanggung jawab penuh berinteraksi dengan SQLite via Drizzle ORM (insert, update, select)[cite: 1].
5. **Respon Klien**: Repository mengembalikan hasil *query* (misal ID masalah yang baru dibuat) ke Service, lalu diteruskan kembali oleh API Route ke klien dengan standar kode HTTP.

---

## 5. Identifikasi Risiko dan Mitigasi

### A. Risiko Keamanan
1. **Kerentanan File Upload (Path Traversal & Eksekusi Skrip Bebas)**
   * **Risiko**: Mengingat aplikasi menyimpan file lokal di folder `/uploads`[cite: 1], pengguna iseng bisa mengunggah file `.php`, `.js` (berpotensi diakses publik), atau melakukan eksploitasi path (misal penamaan file `../../../system.exe`).
   * **Mitigasi**: Implementasi *input sanitization* ketat pada Endpoint API Upload. Tolak ekstensi file di luar spesifikasi (jpg, png, pdf, docx) secara sisi server, ganti nama file sepenuhnya (misalnya dengan UUID v4), dan periksa limitasi MIME types selain dari ekstensi file.
2. **Keterbukaan Data Lokal**
   * **Risiko**: Karena berjalan murni di mesin pribadi, seseorang yang bisa mengakses fisik laptop admin (atau server lokalnya) dapat langsung membuka file `.sqlite` dan mengedit isinya secara *bypass* melewati validasi aplikasi.
   * **Mitigasi**: Pastikan enkripsi level sistem operasi (seperti BitLocker) aktif, serta edukasi log off aplikasi jika tidak dipakai (walau *session expire* dalam 8 jam[cite: 1]).

### B. Risiko Performa
1. **Penurunan Performa Database Seiring Waktu (Disk I/O Bottleneck)**
   * **Risiko**: Meskipun diklaim mampu menampilkan lebih dari 1000 baris dengan responsif[cite: 1], SQLite rentan *lock/blocking* ketika dilakukan *read* dan *write* pada saat yang persis bersamaan, terlebih jika lampiran data membesar[cite: 1].
   * **Mitigasi**: Pastikan fitur **WAL (Write-Ahead Logging)** benar-benar diaktifkan saat inisialisasi koneksi Drizzle ORM[cite: 1]. Tambahkan indeks (*indexing*) yang memadai pada kolom-kolom kritis seperti `status`, `created_at`, dan kolom foreign key (misal: `issue_id`) untuk mempercepat agregasi pada API Dashboard dan pergerakan filter tabel[cite: 1].
2. **Beban Memori pada Eksportir Dokumen**
   * **Risiko**: Proses eksport Excel atau PDF berbasis *puppeteer* untuk daftar ribuan baris dapat menghabiskan RAM pada Node server Nuxt.
   * **Mitigasi**: Jangan memuat seluruh data ke memori; gunakan skema paginasi (batasan limit), atau render PDF *stream-based*.


**Saran Best Practice untuk File Analisa Supplier & Foto** :
Karena supplier sering mengirimkan 1 file PDF utuh yang berisi analisa untuk banyak part sekaligus (dalam 1 notification number), sangat tidak efisien jika Anda harus mengunggah file yang sama berulang kali di setiap part.
Oleh karena itu, pendekatannya adalah:

Untuk Laporan File Utuh (PDF dari Supplier): Unggah file tersebut di level Quality Issue (masukkan sebagai update progress di tabel quality_issue_details).

Untuk Kesimpulan Singkat & Foto Fisik Part: Gunakan tabel sample_defects untuk mencatat kesimpulan teksnya saja per part, dan lampirkan foto fisik part tersebut menggunakan tabel attachments yang kita modifikasi sedikit agar bisa menempel ke sampel.




import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 1. Tabel Utama: Quality Issue
export const qualityIssues = sqliteTable('quality_issues', {
  id: integer('id').primaryKey({ autoIncrement: true }), // Disembunyikan dari UI
  issueName: text('issue_name').notNull(),
  modelName: text('model_name').notNull(),
  serialNumber: text('serial_number').notNull(),
  tanggalKejadian: text('tanggal_kejadian').notNull(), // [BARU] Disimpan sebagai ISO Date string
  notificationNumber: text('notification_number'),
  detail: text('detail'),
  keterangan: text('keterangan'),
  status: text('status').notNull().default('Open'), 
  // (Kolom createdAt & updatedAt disembunyikan untuk sekarang)
});

// 2. Tabel Detail: Riwayat Action (1-to-Many ke Quality Issue)
export const qualityIssueDetails = sqliteTable('quality_issue_details', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id')
    .notNull()
    .references(() => qualityIssues.id, { onDelete: 'cascade' }),
  tanggal: text('tanggal').notNull(), // Disimpan sebagai ISO Date string
  action: text('action').notNull(),
  remark: text('remark'),
  // (Kolom attachmentUrl dihapus dan dipindah ke tabel terpisah)
  // (Kolom createdAt & updatedAt disembunyikan untuk sekarang)
});

// 3. Tabel Media: Lampiran File/Foto (1-to-Many ke Riwayat Action)
export const attachments = sqliteTable('attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  detailId: integer('detail_id')
    .notNull()
    .references(() => qualityIssueDetails.id, { onDelete: 'cascade' }),
  sampleId: integer('sample_id').references(() => sampleDefects.id, { onDelete: 'cascade' }),
  reportId: integer('report_id').references(() => technicalReports.id, { onDelete: 'cascade' }),
  
  fileName: text('file_name').notNull(), // Nama file (berguna untuk UI)
  fileUrl: text('file_url').notNull(),   // Path file lokal, contoh: '/uploads/foto-1.jpg'
  fileType: text('file_type').notNull(), // Ekstensi atau MIME type (misal: 'image/jpeg')
  fileSize: integer('file_size'),        // Ukuran file dalam bytes (berguna untuk audit/limit size)
});

export const sampleDefects = sqliteTable('sample_defects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Relasi ke Quality Issue (Opsional, jika klaimnya sudah dibuat di sistem)
  issueId: integer('issue_id').references(() => qualityIssues.id, { onDelete: 'set null' }),
  
  // 1. Data Master / Awal (Dari Notifikasi Cabang)
  notificationNumber: text('notification_number').notNull(),
  modelName: text('model_name').notNull(),
  serialNumber: text('serial_number').notNull(),
  cabang: text('cabang').notNull(),
  partNumber: text('part_number').notNull(),
  partName: text('part_name').notNull(),
  kerusakanCabang: text('kerusakan_cabang').notNull(), 
  
  // STATUS TRACKING (Misal: Diminta, Diterima, Diserahkan ke PQA, Selesai)
  status: text('status').notNull().default('Diminta'),
  
  // 3. QRCC Menerima dari CS
  tanggalTerima: text('tanggal_terima'), // Diisi saat status berubah jadi "Diterima"
  keteranganTerima: text('keterangan_terima'),
  
  // 4. QRCC Menyerahkan ke PQA
  namaPenerimaPqa: text('nama_penerima_pqa'),
  tanggalSerahPqa: text('tanggal_serah_pqa'), // Diisi saat diserahkan
  
  // 5. Hasil Analisa PQA
  kerusakanVerifikasi: text('kerusakan_verifikasi'),
  kondisiPqa: text('kondisi_pqa'), // Isi dengan "NG" atau "NDF" (No Defect Found)
  repair: text('repair'),
  
  // 6. Hasil Analisa Supplier (Teks Singkat)
  hasilAnalisaSupplier: text('hasil_analisa_supplier'), 
});

**Penjelasan Alur Implementasi di UI (Front-end) Sample Defect**:
Langkah 1 & 2: Anda membuat data sampel baru. Anda isi data Master. Karena Anda meminta lebih dari satu part untuk 1 notifikasi, di UI nanti Anda bisa membuat tombol "Tambah Part Lain", yang di belakang layar akan melakukan insert beberapa baris sekaligus ke tabel sample_defects dengan notificationNumber yang sama. Status defaultnya langsung "Diminta".

Langkah 3: CS mengirim barang. Anda klik tombol "Terima" di aplikasi. Sistem mengupdate kolom tanggalTerima, keteranganTerima, dan mengubah status jadi "Diterima".

Langkah 4: Anda serahkan barang ke PQA. Anda klik tombol "Serahkan". Sistem mengupdate kolom namaPenerimaPqa, tanggalSerahPqa, dan mengubah status jadi "Diserahkan ke PQA".

Langkah 5: PQA lapor hasil. Anda update kolom verifikasi PQA. Jika PQA memberikan foto, Anda unggah foto tersebut, dan sistem akan menyimpannya ke tabel attachments dengan mengisi sampleId (id dari part tersebut).

Langkah 6: Supplier kirim file PDF laporan keseluruhan. Anda buka menu Quality Issue -> Klik "Update Progress" -> Tulis "Terima Hasil Laporan Supplier" dan unggah file PDF-nya. Lalu kembali ke menu Sample Defect untuk sekadar mengetik intisari per part di kolom hasilAnalisaSupplier.


// --- TABEL TECHNICAL REPORTS (UPDATED) ---
export const technicalReports = sqliteTable('technical_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Relasi opsional ke Quality Issue
  issueId: integer('issue_id')
    .references(() => qualityIssues.id, { onDelete: 'set null' }), 
  
  // Identitas Dokumen
  documentNumber: text('document_number').notNull().unique(),
  documentType: text('document_type').notNull(), // Misal: "Technical Report" atau "Service Tips"
  releaseDate: text('release_date').notNull(),   // Tanggal rilis laporan
  
  // Detail Masalah & Analisa (Tambahan Baru)
  modelName: text('model_name').notNull(),
  issueName: text('issue_name').notNull(),       // Nama masalah/isu yang dibahas
  rootCause: text('root_cause'),                 // Akar masalah
  action: text('action'),                        // Tindakan perbaikan yang dilakukan
  
  // Data Improvement (Tambahan Baru)
  improvementStartDate: text('improvement_start_date'),                 // Tanggal mulai penerapan (ISO Date)
  improvementStartSerialNumber: text('improvement_start_serial_number'),// Nomor seri awal penerapan perbaikan
  
  // Referensi & Keterangan Tambahan
  documentReference: text('document_reference'), // Referensi dokumen lain (dalam bentuk teks/nomor dokumen)
  keterangan: text('keterangan'),                // Catatan tambahan
});