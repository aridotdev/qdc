## TASK-029: Tambah Public ID UUIDv7 untuk Domain Utama

### Tujuan

Tambahkan identifier publik yang unik dan tidak berurutan untuk tiga tabel utama:

- `quality_issues.public_id` dengan prefix `QI-`
- `sample_defects.public_id` dengan prefix `SD-`
- `technical_reports.public_id` dengan prefix `TR-`

Primary key internal dan seluruh foreign key tetap menggunakan integer
auto-increment yang sudah ada. `public_id` tidak menggantikan `id`, tidak
dipakai sebagai FK, dan tidak mengubah relasi database.

### Keputusan desain

- [x] Simpan `public_id` sebagai `text`.
- [x] Gunakan UUIDv7 dari library yang teruji; jangan membuat algoritma UUIDv7
      sendiri.
- [x] Format canonical:
      `QI-<uuid-v7>`, `SD-<uuid-v7>`, `TR-<uuid-v7>`.
- [x] Prefix menggunakan huruf besar; UUID menggunakan format lowercase
      canonical.
- [x] `public_id` dibuat server-side saat record dibuat dan tidak dapat diubah
      pada update.
- [x] Tambahkan unique index pada masing-masing tabel.
- [x] Jangan memakai Unix millisecond saja karena dapat collision pada request
      yang terjadi dalam millisecond yang sama.
- [x] Jangan mengganti primary key integer atau foreign key pada task ini.
- [x] Jangan mengubah `audit_logs.entity_id`; audit log tetap merujuk ke ID
      internal.
- [x] Tahap pertama tetap kompatibel dengan API dan URL numeric yang sudah ada.
      Migrasi URL ke `public_id` hanya dilakukan setelah persistence dan
      backfill tervalidasi.

### Tahap 1 — Persiapan dan kontrak

- [x] Pastikan working tree dan migration saat ini dipahami; jangan membatalkan
      perubahan UI yang tidak terkait.
- [x] Pilih dependency UUIDv7 yang maintained dan memiliki API `v7()` atau
      API setara.
- [x] Tambahkan dependency hanya jika belum tersedia, lalu commit lockfile.
- [x] Tetapkan helper terpusat, misalnya
      `server/utils/public-id.ts`, yang:
      - menerima jenis entity (`QI`, `SD`, atau `TR`);
      - menghasilkan `${prefix}-${uuidv7()}`;
      - tidak menerima nilai timestamp dari client;
      - tidak mengandung retry loop yang tidak perlu.
- [x] Tetapkan validator format public ID untuk kebutuhan response, lookup, dan
      test. Validator harus membedakan prefix yang benar untuk setiap entity.
- [x] Tetapkan bahwa `public_id` bukan bagian dari input create/update dari
      client.

Status tahap 1: selesai. Kontrak dan helper tersedia di
`shared/constants/public-id.ts`, `shared/validators/public-id.ts`, dan
`server/utils/public-id.ts`. Schema database tahap 2 sudah tersedia; backfill,
response, dan pemakaian UI tetap menunggu tahap berikutnya.

### Tahap 2 — Perubahan schema database

- [x] Tambahkan kolom `public_id` ke:
      - `server/database/schema/quality-issues.ts`
      - `server/database/schema/sample-defects.ts`
      - `server/database/schema/technical-reports.ts`
- [x] Definisikan kolom sebagai `text`, `NOT NULL` pada schema final, dan
      tidak memiliki default SQL yang dibuat sendiri.
- [x] Tambahkan unique index yang jelas dan konsisten:
      - `quality_issues_public_id_unique`
      - `sample_defects_public_id_unique`
      - `technical_reports_public_id_unique`
- [x] Pastikan insert schema menghapus `publicId` dari input client atau
      menjadikannya field internal yang hanya diisi service.
- [x] Pastikan update schema tidak mengizinkan `publicId` berubah.
- [x] Generate migration dari schema, lalu review SQL yang dihasilkan sebelum
      menjalankannya.

Status tahap 2: selesai. Migration
`20261012225212_dusty_chameleon` sudah direview dan tervalidasi pada database
kosong. Karena kolom final `NOT NULL` belum dapat ditambahkan ke database yang
sudah berisi data, penerapan pada database existing menunggu prosedur backfill
dan rebuild SQLite di tahap 3.

### Tahap 3 — Migrasi data existing

- [ ] Rancang migration SQLite secara bertahap karena existing row belum
      memiliki `public_id`:
      1. Tambahkan kolom sementara yang nullable.
      2. Tambahkan unique index setelah nilai diisi, atau pastikan index
         nullable aman selama proses backfill.
      3. Isi semua row lama menggunakan helper UUIDv7 server-side.
      4. Verifikasi tidak ada nilai `NULL`, duplicate, prefix salah, atau UUID
         invalid.
      5. Enforce `NOT NULL` pada migration SQLite berikutnya/rebuild table bila
         diperlukan oleh Drizzle.
- [ ] Buat command/script backfill sekali pakai yang idempotent:
      hanya mengisi row dengan `public_id IS NULL`.
- [ ] Jalankan backfill untuk ketiga tabel dalam urutan yang jelas:
      `quality_issues`, `sample_defects`, lalu `technical_reports`.
- [ ] Jangan membuat `public_id` lama dari `id` integer; setiap row harus
      mendapat UUIDv7 yang valid.
- [ ] Uji migration pada:
      - database SQLite kosong;
      - database dengan data existing;
      - database dengan data yang sudah pernah menjalankan backfill.
- [ ] Setelah backfill sukses, hapus/arsipkan script sekali pakai sesuai pola
      repository agar tidak menjadi jalur runtime permanen.

### Tahap 4 — Generate ID pada semua jalur create

- [ ] Isi `public_id` di server sebelum insert pada Quality Issue.
- [ ] Isi `public_id` di server sebelum insert pada setiap Sample Defect.
      Semua part dalam satu `batch_id` harus tetap memiliki `public_id`
      berbeda.
- [ ] Isi `public_id` di server sebelum insert pada setiap Technical Report.
- [ ] Audit semua jalur insert, termasuk:
      - API/service utama;
      - seed database;
      - script import jika ada;
      - fixture atau helper test yang melakukan direct insert.
- [ ] Pastikan retry request tidak memakai `public_id` dari request sebelumnya.
- [ ] Jika terjadi unique constraint error, perlakukan sebagai error internal;
      jangan mengubah ID menjadi format timestamp custom atau melakukan retry
      tanpa batas.

### Tahap 5 — Backend response dan type

- [ ] Tambahkan `public_id` pada response domain untuk:
      - Quality Issue;
      - Sample Defect;
      - Technical Report.
- [ ] Perbarui `shared/types/domain.ts` dan tipe frontend yang menerima tiga
      entity tersebut.
- [ ] Perbarui response create Quality Issue agar tetap mengembalikan
      `issueId` numeric untuk kompatibilitas dan juga `publicId`.
- [ ] Jangan menghapus field `id` numeric dari response pada tahap pertama.
- [ ] Pastikan list, detail, create, update, dan delete tetap bekerja dengan
      ID internal seperti sebelumnya.
- [ ] Tambahkan query repository berdasarkan `public_id` hanya bila diperlukan
      oleh tahap penggunaan URL atau pencarian publik; jangan menambah
      abstraction repository yang belum dipakai.

### Tahap 6 — Pemakaian di UI

- [ ] Tampilkan `public_id` pada tabel/detail yang membutuhkan identifier yang
      dapat dibaca user.
- [ ] Gunakan `public_id` pada export atau komunikasi user bila field ID perlu
      ditampilkan.
- [ ] Jangan menampilkan `id` integer internal sebagai identifier publik baru.
- [ ] Pertahankan route numeric existing selama tahap pertama agar bookmark dan
      integrasi lama tidak rusak.
- [ ] Jangan menambahkan formatter atau komponen khusus jika tampilan text
      sederhana sudah cukup.

### Tahap 7 — Optional: migrasi URL ke public ID

Kerjakan hanya setelah tahap persistence, backfill, dan response stabil.

- [ ] Tambahkan lookup `findByPublicId` pada repository yang benar-benar
      membutuhkan URL public.
- [ ] Ubah route detail Quality Issue untuk menerima `QI-<uuid-v7>`.
- [ ] Selama masa kompatibilitas, route dapat menerima ID numeric lama dan
      public ID baru.
- [ ] Ubah redirect create baru ke URL public ID hanya setelah route lookup
      public sudah teruji.
- [ ] Perbarui link pada list/detail agar menggunakan `public_id`.
- [ ] Uji URL dengan prefix salah, UUID invalid, entity tidak ditemukan, dan
      numeric ID lama.
- [ ] Jangan migrasikan seluruh route Sample Defect dan Technical Report jika
      halaman/API-nya belum membutuhkan public URL.

### Tahap 8 — Test dan verifikasi

- [ ] Unit test generator:
      - prefix `QI`, `SD`, `TR` benar;
      - UUID valid;
      - dua hasil berturut-turut berbeda;
      - generator tidak menerima prefix arbitrary jika API dibuat typed.
- [ ] Schema/integration test:
      - setiap tabel menyimpan `public_id`;
      - unique constraint menolak duplicate pada tabel yang sama;
      - public ID antar jenis entity memiliki prefix berbeda;
      - FK integer dan cascade/set-null tetap berfungsi.
- [ ] Migration test:
      - database kosong;
      - existing data;
      - backfill idempotent;
      - semua existing row memiliki public ID setelah migration.
- [ ] Service test:
      - create Quality Issue menghasilkan `QI-...`;
      - create Sample Defect menghasilkan `SD-...`;
      - create Technical Report menghasilkan `TR-...`;
      - update tidak mengubah `public_id`.
- [ ] Regression test:
      - query berdasarkan `id` numeric tetap berjalan;
      - audit log tetap menyimpan `entity_id` numeric;
      - attachment dan relasi existing tidak berubah;
      - seed dan test fixture tetap dapat dijalankan.
- [ ] Jalankan pemeriksaan repository:
      - `pnpm typecheck`
      - `pnpm lint`
      - `pnpm test:unit`
      - `pnpm test:integration`
      - `pnpm db:generate` lalu review migration yang dihasilkan
- [ ] Verifikasi manual satu record baru dari masing-masing tabel dan catat
      contoh public ID yang dihasilkan.

### Acceptance criteria

- [ ] Tiga tabel memiliki `public_id` text yang valid, unique, dan terisi.
- [ ] Record baru selalu mendapat prefix yang benar:
      `QI-`, `SD-`, atau `TR-`.
- [ ] Tidak ada perubahan tipe pada primary key internal dan foreign key.
- [ ] Tidak ada perubahan perilaku pada attachment, audit log, cascade, atau
      `set null`.
- [ ] Data lama memiliki public ID setelah migration/backfill.
- [ ] Tidak ada jalur client yang dapat menentukan atau mengubah public ID.
- [ ] Numeric API/URL lama tetap kompatibel pada tahap pertama.
- [ ] Tidak ada custom generator timestamp-only dan tidak ada unbounded retry.

### Non-goals

- [ ] Jangan mengganti `id` integer menjadi UUID.
- [ ] Jangan mengganti semua FK menjadi text.
- [ ] Jangan mengubah `audit_logs.entity_id` menjadi polymorphic text pada task
      ini.
- [ ] Jangan membuat sequence service, distributed ID service, atau tabel
      counter baru.
- [ ] Jangan menggunakan `QI-unix-millisecond` tanpa random UUID/suffix.
- [ ] Jangan memigrasikan seluruh URL/API bila kebutuhan public ID baru sebatas
      display dan export.
