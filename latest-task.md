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
`server/utils/public-id.ts`. Schema database tahap 2, backfill tahap 3, dan
generate ID tahap 4 sudah tersedia; response dan pemakaian UI dikerjakan pada
tahap berikutnya.

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

Status tahap 2: selesai. Schema final dan unique index
`20261012225212_dusty_chameleon` sudah direview. Migration menambahkan kolom
nullable sebagai tahap transisi; pengisian data dan enforcement `NOT NULL`
dilakukan oleh backfill tahap 3.

### Tahap 3 — Migrasi data existing

- [x] Rancang migration SQLite secara bertahap karena existing row belum memiliki `public_id`:
      1. Tambahkan kolom sementara yang nullable.
      2. Tambahkan unique index setelah nilai diisi, atau pastikan index nullable aman selama proses backfill.
      3. Isi semua row lama menggunakan helper UUIDv7 server-side.
      4. Verifikasi tidak ada nilai `NULL`, duplicate, prefix salah, atau UUID invalid.
      5. Enforce `NOT NULL` pada migration SQLite berikutnya/rebuild table bila diperlukan oleh Drizzle.
- [x] Buat command/script backfill sekali pakai yang idempotent:
      hanya mengisi row dengan `public_id IS NULL`.
- [x] Jalankan backfill untuk ketiga tabel dalam urutan yang jelas:
      `quality_issues`, `sample_defects`, lalu `technical_reports`.
- [x] Jangan membuat `public_id` lama dari `id` integer; setiap row harus mendapat UUIDv7 yang valid.
- [x] Uji migration pada:
      - database SQLite kosong;
      - database dengan data existing;
      - database dengan data yang sudah pernah menjalankan backfill.
- [x] Setelah backfill sukses, pertahankan command sebagai utilitas operasional
      idempotent sesuai pola repository; command tidak dipakai sebagai jalur
      runtime request.

Status tahap 3: selesai. Migration menambahkan kolom nullable dan unique index
yang aman selama proses transisi. Command `pnpm db:backfill-public-id`
mengisi row lama, memverifikasi public ID, lalu melakukan rebuild SQLite untuk
menegakkan `NOT NULL`. Command tersebut idempotent dan hanya mengisi row dengan
`public_id IS NULL`.

### Tahap 4 — Generate ID pada semua jalur create

- [x] Isi `public_id` di server sebelum insert pada Quality Issue.
- [x] Isi `public_id` di server sebelum insert pada setiap Sample Defect.
      Semua part dalam satu `batch_id` harus tetap memiliki `public_id`
      berbeda.
- [x] Isi `public_id` di server sebelum insert pada setiap Technical Report.
- [x] Audit semua jalur insert, termasuk:
      - API/service utama yang sudah tersedia;
      - seed database;
      - script import jika ada;
      - fixture atau helper test yang melakukan direct insert.
      Jalur direct insert server dan fixture tetap memakai runtime default
      function sebagai fallback; setiap pemanggilan insert menghasilkan UUIDv7
      baru.
- [x] Pastikan retry request tidak memakai `public_id` dari request sebelumnya.
      ID dibuat ulang pada setiap create request dan tidak berasal dari payload
      client.
- [x] Jika terjadi unique constraint error, perlakukan sebagai error internal;
      jangan mengubah ID menjadi format timestamp custom atau melakukan retry
      tanpa batas.

Status tahap 4: selesai. Quality Issue service dan development seed mengisi
`public_id` secara eksplisit sebelum insert untuk masing-masing entity. Direct
insert server yang belum memiliki service/repository khusus tetap dilindungi
oleh runtime default function pada schema; fixture menguji bahwa setiap row
Sample Defect dalam batch yang sama mendapat public ID berbeda.

### Tahap 5 — Backend response dan type

- [x] Tambahkan `public_id` pada response domain untuk:
      - Quality Issue;
      - Sample Defect;
      - Technical Report.
- [x] Perbarui `shared/types/domain.ts` dan tipe frontend yang menerima tiga
      entity tersebut. Shared domain type menggunakan `public_id`, sedangkan
      response server/frontend existing menggunakan `publicId`.
- [x] Perbarui response create Quality Issue agar tetap mengembalikan
      `issueId` numeric untuk kompatibilitas dan juga `publicId`.
- [x] Jangan menghapus field `id` numeric dari response pada tahap pertama.
- [x] Pastikan list, detail, create, update, dan delete tetap bekerja dengan
      ID internal seperti sebelumnya.
- [x] Tambahkan query repository berdasarkan `public_id` hanya bila diperlukan
      oleh tahap penggunaan URL atau pencarian publik; jangan menambah
      abstraction repository yang belum dipakai. Tahap ini belum membutuhkan
      query tersebut.

Status tahap 5: selesai. Response list, detail, update, dan state transition
tetap mengembalikan `id` numeric serta `publicId` dari row domain. Response
create Quality Issue mengembalikan `issueId` numeric dan `publicId`. Shared
domain type untuk tiga entity memiliki `public_id`; tipe frontend yang sudah
digunakan untuk Quality Issue dan create response ikut diperbarui. Lookup
public ID untuk URL dikerjakan pada tahap 7.

### Tahap 6 — Pemakaian di UI

- [x] Tampilkan identifier yang dapat dibaca user pada tabel/detail yang
      membutuhkan ID operasional. Tabel Quality Issue menampilkan `businessId`
      dengan fallback `id` numeric untuk row lama.
- [x] Gunakan identifier operasional pada export atau komunikasi user bila
      field ID perlu ditampilkan. Export belum tersedia; toast create Quality
      Issue menampilkan `businessId` dan fallback ke `publicId`.
- [x] Jangan memakai `id` integer internal sebagai public URL identifier baru.
- [x] Pertahankan route numeric existing selama masa kompatibilitas agar
      bookmark dan integrasi lama tidak rusak.
- [x] Jangan menambahkan formatter atau komponen khusus jika tampilan text
      sederhana sudah cukup.

Status tahap 6: selesai. Quality Issue list dan feedback create memakai
`businessId` sebagai ID operasional yang mudah dibaca. Migrasi URL tetap
memakai `publicId` dan ditangani pada tahap 7.

### Tahap 7 — Optional: migrasi URL ke public ID

Kerjakan hanya setelah tahap persistence, backfill, dan response stabil.

- [x] Tambahkan lookup `findByPublicId` pada repository yang benar-benar
      membutuhkan URL public.
- [x] Ubah route detail Quality Issue untuk menerima `QI-<uuid-v7>`.
- [x] Selama masa kompatibilitas, route dapat menerima ID numeric lama dan
      public ID baru.
- [x] Ubah redirect create baru ke URL public ID setelah route lookup
      public sudah teruji.
- [x] Perbarui link pada list/detail agar menggunakan `public_id`. Link list
      dan redirect create Quality Issue memakai `publicId`.
- [x] Uji URL dengan prefix salah, UUID invalid, entity tidak ditemukan, dan
      numeric ID lama melalui parser identifier dan repository lookup.
- [x] Jangan migrasikan seluruh route Sample Defect dan Technical Report karena
      halaman/API-nya belum membutuhkan public URL.

Status tahap 7: selesai. Endpoint Quality Issue yang memakai parameter `[id]`
menerima ID numeric lama dan `QI-<uuid-v7>` baru. Lookup public ID tetap
diterjemahkan ke integer internal sebelum service, relasi, audit log, dan
attachment diproses.

Catatan lanjutan: tabel Quality Issue menampilkan `businessId` pada kolom ID
sesuai kebutuhan UI. Link row dan redirect create tetap memakai `publicId`.

### Addendum — Business ID operasional

- [x] Tambahkan `business_id` untuk tiga entity utama tanpa mengubah
      `public_id` UUIDv7 yang sudah dibuat.
- [x] Format:
      - Quality Issue: `QI-yyyymmdd-xxx`
      - Sample Defect: `SD-yyyymmdd-xxx`
      - Technical Report: `TR-yyyymmdd-xxx`
- [x] Sequence `xxx` tiga digit, reset per hari dan per entity.
- [x] Tambahkan counter sederhana `business_id_counters` dengan primary key
      `(entity, business_date)`.
- [x] Quality Issue service membuat `businessId` dalam transaction sebelum
      insert.
- [x] Development seed mengisi `businessId` untuk Quality Issue, Sample Defect,
      dan Technical Report.
- [x] Migration melakukan backfill row existing dan memasang trigger fallback
      untuk direct insert server/fixture yang tidak mengirim `business_id`.
- [x] Schema insert/update client tidak menerima `businessId`.
- [x] List Quality Issue menampilkan `businessId`; route dan redirect tetap
      memakai `publicId`.
- [x] `public_id` tetap dipertahankan sebagai opaque public URL/API identifier;
      primary key, foreign key, dan audit log tetap memakai `id` integer.
- [x] Test unit dan integration mencakup format business ID, trigger direct
      insert, schema omit, dan service create Quality Issue.

### Tahap 8 — Test dan verifikasi

- [x] Unit test generator:
      - prefix `QI`, `SD`, `TR` benar;
      - UUID valid;
      - dua hasil berturut-turut berbeda;
      - generator tidak menerima prefix arbitrary jika API dibuat typed.
- [x] Schema/integration test:
      - setiap tabel menyimpan `public_id`;
      - unique constraint menolak duplicate pada tabel yang sama;
      - public ID antar jenis entity memiliki prefix berbeda;
      - FK integer dan cascade/set-null tetap berfungsi.
- [x] Migration test:
      - database kosong;
      - existing data;
      - backfill idempotent;
      - semua existing row memiliki public ID setelah migration.
- [x] Service test:
      - create Quality Issue menghasilkan `QI-...`;
      - seed/direct insert Sample Defect menghasilkan `SD-...`;
      - seed/direct insert Technical Report menghasilkan `TR-...`;
      - update tidak mengubah `public_id`.
- [x] Regression test:
      - query berdasarkan `id` numeric tetap berjalan;
      - audit log tetap menyimpan `entity_id` numeric;
      - attachment dan relasi existing tidak berubah;
      - seed dan test fixture tetap dapat dijalankan.
- [x] Jalankan pemeriksaan repository:
      - `pnpm typecheck`
      - `pnpm lint`
      - `pnpm test:unit`
      - `pnpm test:integration`
      - `pnpm test:e2e`
      - `pnpm db:generate` lalu review migration yang dihasilkan
- [ ] Verifikasi manual satu record baru dari masing-masing tabel dan catat
      contoh public/business ID yang dihasilkan. Automated integration test
      sudah memverifikasi direct insert ketiga entity.

### Acceptance criteria

- [x] Tiga tabel memiliki `public_id` text yang valid, unique, dan terisi.
- [x] Record baru selalu mendapat prefix yang benar:
      `QI-`, `SD-`, atau `TR-`.
- [x] Tidak ada perubahan tipe pada primary key internal dan foreign key.
- [x] Owner, audit log, cascade, dan `set null` pada attachment tetap
      dipertahankan.
- [x] Layout storage attachment baru memakai section, tahun laporan, dan
      `businessId`; file lama tetap menggunakan path sebelumnya.
- [x] Data lama memiliki public ID setelah migration/backfill.
- [x] Tidak ada jalur client yang dapat menentukan atau mengubah public ID.
- [x] Numeric API/URL lama tetap kompatibel pada tahap pertama.
- [x] Tidak ada custom generator timestamp-only dan tidak ada unbounded retry.

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
