# Product Requirements Document
# QRCC Data Center - Web Application

**Version:** 1.0.0
**Status:** Baseline keputusan untuk implementasi
**Tanggal:** September 2026  
**Target:** Localhost, single-user, Admin/Personal

## 1. Ringkasan Produk

QRCC Data Center adalah aplikasi web lokal untuk menjadi single source of truth
atas quality issue dari pasar, sample defect, dan arsip Technical Report /
Service Tips. Aplikasi harus memudahkan pencatatan, pelacakan progres,
pencarian histori, attachment bukti, export, dan backup lokal.

Pengguna operasional adalah satu akun personal. Walaupun tidak ada kebutuhan
RBAC kompleks, server tetap membedakan operasi biasa dan operasi admin untuk
melindungi rollback serta penghapusan data.

## 2. Tujuan dan Masalah

### 2.1 Masalah

Pencatatan quality issue, pergerakan sampel komponen, dan technical report masih
tersebar atau manual. Akibatnya histori sulit dicari, progres sulit dipantau,
dan bukti pendukung tidak memiliki lifecycle yang jelas.

### 2.2 Tujuan MVP

- Memusatkan data quality issue, sample defect, dan technical report.
- Menyediakan state machine yang konsisten untuk progres operasional.
- Menyimpan attachment lokal dengan validasi dan cleanup yang dapat ditelusuri.
- Menyediakan dashboard, pencarian, filter, pagination, export, dan backup.
- Menjaga separation of concerns antara API route, service, repository, dan UI.

## 3. Scope

### 3.1 In Scope

- Login, logout, session expiry, dan protected route menggunakan Better-auth.
- Dashboard KPI, ringkasan status, trend sample defect, dan recent records.
- CRUD Quality Issue, progress timeline, status transition, dan attachment.
- Batch request Sample Defect yang atomic dan state transition per part.
- CRUD Technical Report / Service Tips, attachment, dan relasi optional ke
  Quality Issue.
- Server-side search, filter, sorting whitelist, dan pagination.
- Export Excel serta PDF untuk data penuh atau hasil filter.
- Admin-only delete, rollback, backup, retention, integrity check, dan restore.
- Unit test, integration test, E2E critical flow, build, dan smoke test.

### 3.2 Out of Scope

- Multi-user collaboration dan role management kompleks.
- Email, push notification, atau integrasi pihak ketiga.
- Mobile app native, i18n, dan integrasi ERP.
- Cloud storage atau sinkronisasi cloud.
- Workflow approval formal di luar state machine yang didefinisikan.

## 4. Aktor dan Authorization

| Aktor | Hak akses |
| --- | --- |
| Authenticated user | Read, create, update, forward transition, upload |
| Admin | Semua hak authenticated user, plus rollback dan delete |

MVP tetap single-user. Akun pertama yang dibuat saat bootstrap ditetapkan
sebagai `ADMIN`. Semua authorization diperiksa server-side; UI hanya membantu
dengan menyembunyikan atau menonaktifkan action yang tidak tersedia.

## 5. Modul dan Kebutuhan Fungsional

### 5.1 Authentication

- Login dengan email/username dan password melalui Better-auth.
- Password di-hash oleh provider auth.
- Session berakhir setelah 8 jam dan dapat diakhiri dengan logout.
- Semua API domain dan halaman aplikasi, kecuali login, wajib terproteksi.

### 5.2 Quality Issue

Data minimum: nama issue, model, serial number, tanggal kejadian, nomor
notifikasi, detail, keterangan, status, timeline progress, dan attachment.

Status internal yang canonical:

```text
OPEN -> IN_PROGRESS -> MONITORING -> CLOSED
```

Forward transition dapat dilakukan oleh authenticated user. Rollback hanya satu
langkah ke belakang dan hanya oleh Admin:

```text
CLOSED -> MONITORING -> IN_PROGRESS -> OPEN
```

Status tidak boleh diubah melalui arbitrary value pada generic update.
Transition harus melalui operation khusus di service.

Attachment saat create Quality Issue dimiliki oleh detail timeline awal yang
dibuat oleh service. Dengan demikian semua attachment Quality Issue tetap
memiliki tepat satu owner yang valid.

### 5.3 Sample Defect

Setiap part disimpan sebagai satu record. Beberapa part dalam satu request
memiliki `batch_id` yang sama dan dibuat dalam satu database transaction.

Status internal yang canonical:

```text
REQUESTED -> RECEIVED -> QRCC_VERIFIED -> HANDED_OVER_TO_PQA
           -> PQA_ANALYZED -> SUPPLIER_ANALYZED
```

Forward transition:

```text
REQUESTED -> RECEIVED
RECEIVED -> QRCC_VERIFIED
QRCC_VERIFIED -> HANDED_OVER_TO_PQA
HANDED_OVER_TO_PQA -> PQA_ANALYZED
PQA_ANALYZED -> SUPPLIER_ANALYZED
```

Admin dapat melakukan rollback satu langkah ke belakang. Field khusus operasi
harus diisi pada operation yang sesuai, misalnya tanggal penerimaan, PIC PQA,
hasil verifikasi, kondisi `NG`/`NDF`, repair, dan hasil analisa supplier.

Sample Defect dapat berdiri sendiri atau memiliki relasi optional ke Quality
Issue. `notification_number` bukan identitas batch; `batch_id` adalah identitas
request.

### 5.4 Technical Report dan Service Tips

Data minimum: nomor dokumen unik, jenis dokumen, tanggal rilis, model, nama
issue, root cause, action, cut-off improvement, referensi dokumen, keterangan,
attachment, dan relasi optional ke Quality Issue.

Jenis dokumen canonical:

```text
TECHNICAL_REPORT
SERVICE_TIPS
```

Masing-masing report dapat standalone atau dikaitkan ke satu Quality Issue.

### 5.5 Attachment

Format yang didukung:

```text
JPG, JPEG, PNG, PDF, DOCX, XLSX, MP4
```

Batas ukuran per file:

| Kategori | Batas |
| --- | ---: |
| Image, document, PDF | 1 MB |
| Video | 10 MB |

Nama file asli disimpan sebagai metadata. Nama fisik dibuat unik dan file
disimpan di storage lokal bertanggal, misalnya `/uploads/YYYY/MM/DD/<uuid>`.
Attachment hanya boleh memiliki satu owner: Quality Issue Detail, Sample
Defect, atau Technical Report.

Kegagalan tulis file dan kegagalan insert metadata harus memiliki kompensasi.
Jika insert database gagal setelah file berhasil ditulis, file fisik dihapus.

### 5.6 Dashboard

Dashboard menampilkan:

- KPI quality issue.
- Distribusi status quality issue.
- Trend sample defect.
- Recent Quality Issue, Sample Defect, dan Technical Report.

Aggregation dilakukan di server melalui query khusus, bukan dengan mengambil
seluruh tabel ke browser.

### 5.7 Search, Filter, Pagination, dan Export

- Pagination dilakukan server-side dengan default page size 20.
- Filter dan search disimpan pada URL query agar shareable dan tahan refresh.
- Sorting hanya boleh memakai field yang di-whitelist.
- Excel memakai format `.xlsx`.
- PDF export tersedia untuk full dataset atau dataset hasil filter.
- Nama file export memuat jenis data dan timestamp.

### 5.8 Backup dan Restore

- SQLite berjalan dengan WAL mode.
- Default backup terjadwal adalah mingguan dan jadwal dapat dikonfigurasi.
- Backup mencakup database dan seluruh attachment.
- Retention menyimpan N backup terbaru.
- Integrity check harus membedakan backup valid dan corrupt.
- Restore harus mengembalikan database, attachment, schema, lalu menjalankan
  smoke test.

## 6. Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Performance | Dashboard dan halaman utama ditargetkan load < 2 detik; tabel 1000+ record tetap memakai pagination |
| Security | Auth, session server-side, authorization server-side, validasi input, dan upload validation |
| Reliability | SQLite WAL, transaction untuk batch, cleanup file, backup, integrity check, restore verification |
| Accessibility | Mendukung browser modern: Chrome, Firefox, Edge |
| Responsive | Desktop dan tablet dengan breakpoint minimum 768 px |
| Maintainability | TypeScript strict, modular component, migration, service/repository boundary |
| Local operation | Aplikasi berjalan di localhost dengan storage dan database lokal |

## 7. Stack dan Engineering Constraints

- Frontend: Nuxt 4, Vue 3 Composition API, Nuxt UI.
- Language: TypeScript strict.
- Server: Nitro server routes.
- Database: SQLite dengan Drizzle ORM.
- Auth: Better-auth.
- Validation: Zod pada API boundary dan service business validation.
- Testing: Vitest untuk unit/integration; E2E untuk critical flow.
- Export: `xlsx` untuk Excel dan `pdfmake` untuk PDF.
- Storage: local filesystem, logical URL `/uploads`.
- Formatting: 2-space indentation, LF, tanpa trailing whitespace.
- Vue component memakai `<script setup lang="ts">`.
- Naming: PascalCase component; camelCase composable/util; test memakai
  `.test.ts` atau `.spec.ts`.

## 8. Separation of Concerns

| Layer | Tanggung jawab | Larangan |
| --- | --- | --- |
| API route | HTTP parsing, auth check, input validation, response mapping | Business rule dan query database langsung |
| Service | Business rule, state machine, transaction, file orchestration | Detail HTTP dan query database langsung |
| Repository | Query Drizzle, CRUD, filter, pagination, aggregation | Business rule dan authorization |
| UI/composable | Rendering, interaction, server state, URL query state | Direct database access |

Struktur target, kontrak API, acceptance criteria, testing, dependency, dan
urutan delivery ada di [implementation.md](implementation.md).
