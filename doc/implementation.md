# QRCC Data Center - Implementation Plan

Dokumen ini adalah checklist implementasi canonical. Setiap task dirancang
agar dapat menjadi satu GitHub issue yang dapat dikerjakan, direview, dan
ditutup secara independen. Acceptance criteria, dependency, dan test scope
merupakan bagian dari definition of done task tersebut.

## 0. Konvensi

Priority:

- `P0`: blocking atau business-critical.
- `P1`: wajib MVP setelah fondasi tersedia.
- `P2`: refinement setelah alur utama stabil.

Status task memakai checkbox Markdown. Judul task dapat dipakai langsung
sebagai judul GitHub issue; acceptance criteria dapat dipakai sebagai issue
body.

## 1. Architecture Baseline

```text
Nuxt UI -> Nitro API Route -> Service -> Repository -> Drizzle/SQLite
```

Aturan:

- API route menangani HTTP, auth check, validation boundary, dan response.
- Service menangani business rule, transition, transaction, dan file
  orchestration.
- Repository menangani query database dan tidak mengetahui authorization.
- UI tidak melakukan query database langsung.
- Status memakai canonical uppercase code.
- Semua mutation domain memiliki audit actor dan timestamp.

Target structure:

```text
app/
  components/{common,dashboard,quality-issue,sample-defect,technical-report,attachment}/
  composables/
  layouts/
  pages/{login,quality-issues,sample-defects,technical-reports}/
server/
  api/{auth,dashboard,quality-issues,sample-defects,technical-reports,attachments,export,backup}/
  database/{schema,migrations,client.ts,seed.ts}
  repositories/
  services/
  validators/
  middleware/
shared/{constants,types,validators}/
tests/{unit,integration,e2e}/
public/uploads/
```

## 1.1 API Contract Baseline

Endpoint berikut adalah target contract. Nama route boleh berubah hanya jika
seluruh UI, test, dan issue terkait diperbarui bersama.

### Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

### Quality Issue

```text
GET    /api/quality-issues
POST   /api/quality-issues
GET    /api/quality-issues/:id
PATCH  /api/quality-issues/:id
DELETE /api/quality-issues/:id

POST   /api/quality-issues/:id/details
GET    /api/quality-issues/:id/details
POST   /api/quality-issues/:id/status
POST   /api/quality-issues/:id/attachments
```

`PATCH` tidak boleh menerima status arbitrary. Perubahan status memakai
operation service yang menerima transition valid.

### Sample Defect

```text
GET    /api/sample-defects
POST   /api/sample-defects
POST   /api/sample-defects/batch
GET    /api/sample-defects/:id
PATCH  /api/sample-defects/:id
DELETE /api/sample-defects/:id

POST   /api/sample-defects/:id/receive
POST   /api/sample-defects/:id/verify
POST   /api/sample-defects/:id/handover
POST   /api/sample-defects/:id/pqa-analysis
POST   /api/sample-defects/:id/supplier-analysis
POST   /api/sample-defects/:id/rollback
```

### Technical Report

```text
GET    /api/technical-reports
POST   /api/technical-reports
GET    /api/technical-reports/:id
PATCH  /api/technical-reports/:id
DELETE /api/technical-reports/:id
POST   /api/technical-reports/:id/attachments
```

### Dashboard, Attachment, Export, dan Backup

```text
GET    /api/dashboard/summary
GET    /api/dashboard/quality-issues
GET    /api/dashboard/sample-defects
GET    /api/attachments/:id
DELETE /api/attachments/:id
GET    /api/export/:resource
POST   /api/backup
GET    /api/backup/status
POST   /api/backup/restore/validate
```

Endpoint backup dan restore harus tetap Admin-only. Endpoint export wajib
menggunakan filter dan sorting whitelist yang sama dengan list repository.

## 2. Project Foundation

- [ ] TASK-001 - Inisialisasi Nuxt 4 project
  - Depends on: -
  - Priority: P0
  - Acceptance:
    - Nuxt 4, Vue 3, TypeScript strict, dan pnpm terkonfigurasi.
    - `pnpm dev` menjalankan aplikasi lokal.
    - Struktur awal app, server, shared, dan tests tersedia.
  - Test:
    - Dev server smoke test.

- [ ] TASK-002 - Konfigurasi Nuxt UI dan application shell
  - Depends on: TASK-001
  - Priority: P0
  - Acceptance:
    - Nuxt UI terpasang dengan theme dasar.
    - Layout public dan authenticated tersedia.
    - Navigation shell memiliki dashboard dan tiga modul utama.
  - Test:
    - Browser smoke test desktop dan tablet.

- [ ] TASK-003 - Siapkan code quality dan verification commands
  - Depends on: TASK-001
  - Priority: P0
  - Acceptance:
    - Script format, lint, typecheck, unit, integration, E2E, build, dan
      preview tersedia.
    - TypeScript memakai strict mode.
    - Formatting menjaga LF, 2-space indentation, dan tanpa trailing whitespace.
  - Test:
    - Semua command berjalan dari clean checkout.

- [ ] TASK-004 - Tetapkan struktur folder dan shared contracts
  - Depends on: TASK-001
  - Priority: P0
  - Acceptance:
    - Folder `server/api`, `server/services`, `server/repositories`,
      `server/database`, `server/validators`, `shared`, dan `tests` tersedia.
    - Constants, domain types, error codes, dan pagination types berada di
      shared layer.
    - Tidak ada query database dari component atau composable.
  - Test:
    - Typecheck dan architecture review.

## 3. Database Foundation

- [ ] TASK-005 - Konfigurasi SQLite dan Drizzle
  - Depends on: TASK-001, TASK-003
  - Priority: P0
  - Acceptance:
    - Drizzle client menggunakan SQLite lokal.
    - Foreign key enforcement dan WAL mode aktif.
    - Database path berasal dari runtime configuration.
  - Test:
    - Connection dan foreign key enforcement test.

- [ ] TASK-006 - Implement schema Quality Issue dan timeline
  - Depends on: TASK-005
  - Priority: P0
  - Acceptance:
    - `quality_issues` dan `quality_issue_details` mengikuti `db-schema.md`.
    - Default status adalah `OPEN`.
    - Audit fields tersedia dan FK detail memakai cascade.
    - `INITIAL_EVIDENCE` dapat menjadi owner attachment awal.
  - Test:
    - Migration dan relation test dari database kosong.

- [ ] TASK-007 - Implement schema Sample Defect
  - Depends on: TASK-005
  - Priority: P0
  - Acceptance:
    - `sample_defects` memiliki `batch_id`, optional `issue_id`, field operasi,
      canonical status, dan audit fields.
    - FK `issue_id` memakai `ON DELETE SET NULL`.
    - Index batch, notification, status, issue, dan model/part tersedia.
  - Test:
    - Insert valid/invalid field dan FK behavior test.

- [ ] TASK-008 - Implement schema Technical Report
  - Depends on: TASK-005
  - Priority: P1
  - Acceptance:
    - `technical_reports` mengikuti field dan constraint canonical.
    - `document_number` unique.
    - `document_type` hanya menerima `TECHNICAL_REPORT` atau `SERVICE_TIPS`.
    - Optional Quality Issue relation memakai `ON DELETE SET NULL`.
  - Test:
    - Duplicate document number dan FK behavior test.

- [ ] TASK-009 - Implement schema Attachment dan owner invariant
  - Depends on: TASK-006, TASK-007, TASK-008
  - Priority: P0
  - Acceptance:
    - Attachment memiliki nama asli, physical `storage_name`, URL, MIME,
      size, audit fields, dan tiga nullable owner FK.
    - Exactly-one-owner divalidasi di database dan service.
    - Owner FK memakai cascade metadata deletion.
  - Test:
    - No-owner, multi-owner, valid-owner, dan cascade cases.

- [ ] TASK-010 - Implement append-only audit log
  - Depends on: TASK-006, TASK-007, TASK-008
  - Priority: P0
  - Acceptance:
    - `audit_logs` mengikuti schema canonical.
    - Create, update, delete, status change, rollback, dan upload dapat dicatat.
    - Status transition dan audit event ditulis dalam transaction yang sama.
  - Test:
    - Audit event test untuk setiap action utama.

- [ ] TASK-011 - Buat migration, seed, dan reset database
  - Depends on: TASK-006, TASK-007, TASK-008, TASK-009, TASK-010
  - Priority: P0
  - Acceptance:
    - Migration dapat dijalankan dari SQLite kosong.
    - Seed development tidak memakai data produksi.
    - Reset database memerlukan command eksplisit.
    - Migration failure tidak meninggalkan state yang dianggap sukses.
  - Test:
    - Clean migration, migrate up, reset, dan re-run migration.

## 4. Authentication dan Authorization

- [ ] TASK-012 - Integrasikan Better-auth
  - Depends on: TASK-001, TASK-003
  - Priority: P0
  - Acceptance:
    - Login, logout, session, password hashing, dan expiry 8 jam tersedia.
    - Auth tables dikelola provider dan tidak diduplikasi oleh schema domain.
    - Bootstrap account pertama dapat ditetapkan sebagai `ADMIN`.
  - Test:
    - Login valid, password invalid, logout, expiry, dan session retrieval.

- [ ] TASK-013 - Tambahkan server-side auth middleware
  - Depends on: TASK-012
  - Priority: P0
  - Acceptance:
    - Semua API domain menolak request tanpa session valid.
    - Route `/login` tetap dapat diakses tanpa session.
    - Session user tersedia bagi service sebagai actor.
  - Test:
    - 401 test pada setiap kelompok endpoint utama.

- [ ] TASK-014 - Tambahkan authorization policy Admin
  - Depends on: TASK-012, TASK-013
  - Priority: P0
  - Acceptance:
    - Read/create/update/forward transition memerlukan authenticated user.
    - Delete dan rollback memerlukan `ADMIN`.
    - Authorization diuji di server, bukan hanya melalui UI.
  - Test:
    - Authenticated non-admin ditolak untuk delete dan rollback.

## 5. File Storage dan Attachment

- [ ] TASK-015 - Implement file storage service
  - Depends on: TASK-003
  - Priority: P0
  - Acceptance:
    - Root storage configurable dan logical URL dimulai dari `/uploads`.
    - Physical path memakai `YYYY/MM/DD` dan generated unique name.
    - Original filename tidak dipakai sebagai physical filename.
    - Path traversal dan overwrite dicegah.
  - Test:
    - Unique filename, date partition, path traversal, dan overwrite test.

- [ ] TASK-016 - Implement central file policy validation
  - Depends on: TASK-003
  - Priority: P0
  - Acceptance:
    - JPG, JPEG, PNG, PDF, DOCX, XLSX, MP4 didukung.
    - Image/document/PDF maksimum 1 MB.
    - Video maksimum 10 MB.
    - Extension, MIME, dan ukuran divalidasi sebelum write.
  - Test:
    - Valid, invalid MIME, invalid extension, over-limit, dan boundary-size test.

- [ ] TASK-017 - Implement attachment service dan compensation
  - Depends on: TASK-009, TASK-015, TASK-016
  - Priority: P0
  - Acceptance:
    - Exactly-one-owner diperiksa sebelum insert.
    - Flow write file lalu insert metadata memiliki cleanup jika insert gagal.
    - Batch upload membersihkan semua file yang sudah ditulis jika operasi
      berakhir gagal.
    - Delete metadata memiliki physical file cleanup dan reconciliation error.
  - Test:
    - File-write failure, DB failure after write, multi-file failure, delete,
      dan orphan cleanup test.

- [ ] TASK-018 - Implement attachment API domain endpoints
  - Depends on: TASK-013, TASK-017
  - Priority: P0
  - Acceptance:
    - Upload dilakukan melalui endpoint Quality Issue, Sample Defect, dan
      Technical Report.
    - `GET /api/attachments/:id` hanya mengembalikan attachment valid.
    - `DELETE /api/attachments/:id` Admin-only dan menghapus physical file.
  - Test:
    - Ownership, auth, invalid owner, download, dan delete test.

## 6. Shared Server Platform

- [ ] TASK-019 - Implement Zod validation contracts
  - Depends on: TASK-004, TASK-006, TASK-007, TASK-008
  - Priority: P0
  - Acceptance:
    - Schema create/update/filter/pagination tersedia untuk tiap domain.
    - Status dan document type memakai enum canonical.
    - Validation error mengembalikan field-level error yang konsisten.
  - Test:
    - Valid payload, missing field, invalid enum, date, dan unsafe input test.

- [ ] TASK-020 - Implement API error dan response convention
  - Depends on: TASK-003, TASK-019
  - Priority: P0
  - Acceptance:
    - HTTP status konsisten untuk 400, 401, 403, 404, 409, dan 500.
    - `createError()` dipakai pada boundary Nitro.
    - Error tidak membocorkan path lokal, secret, atau stack ke client.
  - Test:
    - Contract test validation, auth, forbidden, not found, conflict, dan
      unexpected failure.

- [ ] TASK-021 - Implement reusable pagination, filtering, dan sorting
  - Depends on: TASK-019, TASK-020
  - Priority: P0
  - Acceptance:
    - Default page size 20 dan total count tersedia.
    - Filter dan search dikirim ke server.
    - Sort field dan direction di-whitelist per repository.
    - Query URL dapat dipakai ulang setelah refresh.
  - Test:
    - Empty result, first/last page, invalid page, limit boundary, filter, dan
      sort whitelist test.

## 7. Quality Issue Module

- [ ] TASK-022 - Implement Quality Issue repository
  - Depends on: TASK-006, TASK-021
  - Priority: P0
  - Acceptance:
    - CRUD, detail, timeline, search, filter, sorting, dan pagination tersedia.
    - Repository tidak memuat business rule atau authorization.
    - Query detail mengurutkan timeline secara deterministik.
  - Test:
    - Repository integration test untuk CRUD, filter, pagination, dan ordering.

- [ ] TASK-023 - Implement Quality Issue state machine service
  - Depends on: TASK-006, TASK-010, TASK-014, TASK-022
  - Priority: P0
  - Acceptance:
    - Forward transition hanya mengikuti urutan canonical.
    - Rollback hanya satu langkah dan Admin-only.
    - Invalid transition menghasilkan conflict yang jelas.
    - Status change, audit log, dan update issue atomic.
  - Test:
    - Semua valid transition, semua invalid transition, non-admin rollback, dan
      rollback boundary test.

- [ ] TASK-024 - Implement Quality Issue service dan initial evidence
  - Depends on: TASK-017, TASK-022, TASK-023
  - Priority: P0
  - Acceptance:
    - Create membuat issue status `OPEN`.
    - Attachment create-time dimiliki detail `INITIAL_EVIDENCE`.
    - Add progress membuat timeline dan attachment owner yang benar.
    - Orphan issue/detail/file tidak tertinggal ketika operasi gagal.
  - Test:
    - Create tanpa attachment, create dengan attachment, progress, dan failure
      compensation integration test.

- [ ] TASK-025 - Implement Quality Issue API
  - Depends on: TASK-013, TASK-020, TASK-023, TASK-024
  - Priority: P0
  - Acceptance:
    - Endpoint CRUD dan detail tersedia.
    - Endpoint progress tersedia.
    - Status transition memakai endpoint operation khusus, bukan arbitrary PATCH.
    - Response memuat data yang dibutuhkan list/detail UI.
  - Test:
    - API contract, authorization, validation, conflict, dan not-found test.

- [ ] TASK-026 - Implement Quality Issue list UI
  - Depends on: TASK-002, TASK-021, TASK-025
  - Priority: P0
  - Acceptance:
    - Table menampilkan field penting, status badge, search, filter, sorting,
      pagination, loading, empty, dan error state.
    - Query state tersimpan di URL.
    - Klik row membuka detail.
  - Test:
    - Browser test search, filter, pagination, refresh, empty, dan API error.

- [ ] TASK-027 - Implement Quality Issue create UI
  - Depends on: TASK-016, TASK-025, TASK-026
  - Priority: P0
  - Acceptance:
    - Form field dan file uploader tersedia.
    - Client validation tidak menggantikan API validation.
    - Submit disabled saat pending dan tidak membuat duplicate submit.
    - Berhasil redirect ke detail.
  - Test:
    - Browser test valid create, field error, file error, retry, dan redirect.

- [ ] TASK-028 - Implement Quality Issue detail, timeline, dan actions UI
  - Depends on: TASK-023, TASK-025, TASK-027
  - Priority: P0
  - Acceptance:
    - Detail menampilkan master data, status, timeline, attachment, loading,
      empty, dan error.
    - Action forward/rollback hanya ditampilkan sesuai state dan role.
    - Confirmation dan toast tersedia untuk mutation.
  - Test:
    - E2E create -> detail -> progress -> attachment -> status transition.

## 8. Sample Defect Module

- [ ] TASK-029 - Implement Sample Defect repository
  - Depends on: TASK-007, TASK-021
  - Priority: P0
  - Acceptance:
    - CRUD, detail, batch lookup, search, filter, sorting, dan pagination.
    - Query dapat memfilter batch, notification, status, model, part, dan issue.
  - Test:
    - Repository integration test.

- [ ] TASK-030 - Implement Sample Defect state machine service
  - Depends on: TASK-007, TASK-010, TASK-014, TASK-029
  - Priority: P0
  - Acceptance:
    - Forward transition sesuai urutan canonical.
    - Rollback satu langkah dan Admin-only.
    - Generic update tidak dapat mengubah status.
    - Required fields per operation divalidasi.
  - Test:
    - Valid/invalid transition, required field, role, audit, dan concurrency
      conflict test.

- [ ] TASK-031 - Implement atomic multi-part batch service
  - Depends on: TASK-007, TASK-029, TASK-030
  - Priority: P0
  - Acceptance:
    - Satu request menghasilkan satu `batch_id`.
    - Semua part divalidasi sebelum transaction dimulai.
    - Satu kegagalan me-rollback seluruh batch.
    - Tidak ada partial batch pada retry atau error.
  - Test:
    - Three-part success, third-part failure rollback, duplicate submit, dan
      transaction failure test.

- [ ] TASK-032 - Implement receive sample operation
  - Depends on: TASK-030
  - Priority: P0
  - Acceptance:
    - Hanya `REQUESTED` dapat menjadi `RECEIVED`.
    - `tanggal_terima` dan keterangan tersimpan.
    - Audit event dibuat.
  - Test:
    - Valid receive, repeated receive, invalid state, dan audit test.

- [ ] TASK-033 - Implement QRCC verification operation
  - Depends on: TASK-030
  - Priority: P0
  - Acceptance:
    - Hanya `RECEIVED` dapat menjadi `QRCC_VERIFIED`.
    - Hasil verifikasi required sesuai contract.
    - Audit event dibuat.
  - Test:
    - Valid dan invalid state/field test.

- [ ] TASK-034 - Implement PQA handover operation
  - Depends on: TASK-030
  - Priority: P0
  - Acceptance:
    - Hanya `QRCC_VERIFIED` dapat menjadi `HANDED_OVER_TO_PQA`.
    - PIC PQA dan timestamp wajib tersimpan.
    - Audit event dibuat.
  - Test:
    - Missing PIC, valid handover, repeated handover, dan audit test.

- [ ] TASK-035 - Implement PQA analysis operation
  - Depends on: TASK-017, TASK-030
  - Priority: P0
  - Acceptance:
    - Hanya `HANDED_OVER_TO_PQA` dapat menjadi `PQA_ANALYZED`.
    - `kondisi_pqa` hanya `NG` atau `NDF`.
    - Hasil verifikasi, repair, dan optional photo attachment tersimpan.
  - Test:
    - Valid analysis, invalid condition, attachment failure, dan state test.

- [ ] TASK-036 - Implement supplier analysis operation
  - Depends on: TASK-030
  - Priority: P0
  - Acceptance:
    - Hanya `PQA_ANALYZED` dapat menjadi `SUPPLIER_ANALYZED`.
    - Kesimpulan supplier tersimpan per part.
    - Audit event dibuat.
  - Test:
    - Required conclusion, valid transition, repeated operation, dan audit test.

- [ ] TASK-037 - Implement Sample Defect API
  - Depends on: TASK-013, TASK-020, TASK-031, TASK-032, TASK-033, TASK-034,
    TASK-035, TASK-036
  - Priority: P0
  - Acceptance:
    - CRUD dan batch endpoint tersedia.
    - Endpoint receive, verify, handover, PQA analysis, supplier analysis, dan
      rollback tersedia.
    - Response dan error mengikuti convention shared.
  - Test:
    - API contract, auth, validation, transaction, dan transition integration.

- [ ] TASK-038 - Implement Sample Defect list, batch form, dan detail UI
  - Depends on: TASK-002, TASK-016, TASK-021, TASK-037
  - Priority: P0
  - Acceptance:
    - Form mendukung banyak part dalam satu request.
    - List mendukung search, filter, pagination, dan state lengkap.
    - Detail menampilkan batch, part, field operasi, attachment, dan action
      sesuai state.
    - UI mencegah submit batch kosong dan duplicate submit.
  - Test:
    - E2E create 3 part -> receive -> verify -> handover -> PQA -> supplier.

## 9. Technical Report Module

- [ ] TASK-039 - Implement Technical Report repository
  - Depends on: TASK-008, TASK-021
  - Priority: P1
  - Acceptance:
    - CRUD, detail, search, filter, sorting, pagination, dan unique lookup.
    - Filter document number, type, model, issue, dan release date.
  - Test:
    - Repository integration test.

- [ ] TASK-040 - Implement Technical Report service
  - Depends on: TASK-017, TASK-039
  - Priority: P1
  - Acceptance:
    - Document type dan duplicate number divalidasi.
    - Optional Quality Issue relation diverifikasi.
    - Attachment report memiliki exactly-one-owner.
    - Failure cleanup berjalan.
  - Test:
    - Create, duplicate, invalid relation, attachment, dan cleanup test.

- [ ] TASK-041 - Implement Technical Report API
  - Depends on: TASK-013, TASK-020, TASK-040
  - Priority: P1
  - Acceptance:
    - CRUD dan attachment endpoint tersedia.
    - Duplicate document number menjadi HTTP 409.
    - Optional relation dan attachment dikembalikan pada detail.
  - Test:
    - API contract, authorization, validation, dan conflict test.

- [ ] TASK-042 - Implement Technical Report list, form, dan detail UI
  - Depends on: TASK-002, TASK-016, TASK-021, TASK-041
  - Priority: P1
  - Acceptance:
    - Form mendukung metadata, PDF, XLSX, dan optional Quality Issue.
    - List mendukung search, filter, dan pagination.
    - Detail mendukung attachment open/download dan relation navigation.
  - Test:
    - E2E create report -> upload PDF/XLSX -> link issue -> search -> detail.

## 10. Dashboard, Export, dan Productivity

- [ ] TASK-043 - Implement dashboard aggregation repository/service
  - Depends on: TASK-022, TASK-029, TASK-039
  - Priority: P1
  - Acceptance:
    - KPI, status summary, sample trend, dan recent records memakai aggregation
      query server-side.
    - Query tidak mengambil seluruh tabel ke frontend.
    - Empty dataset menghasilkan nilai aman, bukan error.
  - Test:
    - Aggregation unit/integration test dataset kosong dan normal.

- [ ] TASK-044 - Implement dashboard API dan UI
  - Depends on: TASK-043, TASK-002
  - Priority: P1
  - Acceptance:
    - `/api/dashboard/summary`, quality issues, dan sample defects tersedia.
    - Widget memiliki loading, empty, error, dan responsive state.
    - Link widget mengarah ke filter list yang sesuai.
  - Test:
    - Browser test dashboard normal, empty, error, dan navigation.

- [ ] TASK-045 - Implement Excel export
  - Depends on: TASK-022, TASK-029, TASK-039, TASK-021
  - Priority: P1
  - Acceptance:
    - Export full dan filtered tersedia per modul yang relevan.
    - Export berjalan server-side dengan whitelist field.
    - Filename memiliki module dan timestamp.
  - Test:
    - Content, filter parity, filename, dan download response test.

- [ ] TASK-046 - Implement PDF export
  - Depends on: TASK-022, TASK-029, TASK-039, TASK-021
  - Priority: P1
  - Acceptance:
    - PDF full dan filtered tersedia untuk data yang disepakati.
    - PDF dapat dibuka oleh standard PDF viewer.
    - Filename memiliki module dan timestamp.
  - Test:
    - Generate PDF, open/parse smoke test, filter parity, dan empty dataset.

## 11. Admin Operations, Backup, dan Reliability

- [ ] TASK-047 - Implement admin delete Quality Issue
  - Depends on: TASK-014, TASK-017, TASK-022, TASK-010
  - Priority: P1
  - Acceptance:
    - Admin-only, confirmation, audit delete, cascade detail/attachment
      metadata, dan physical file cleanup.
    - Relasi Sample Defect dan Technical Report menjadi null.
    - Cleanup failure tercatat dan dapat direkonsiliasi.
  - Test:
    - Permission, cascade, relation set-null, file cleanup, dan failure test.

- [ ] TASK-048 - Implement admin delete Sample Defect
  - Depends on: TASK-014, TASK-017, TASK-029, TASK-010
  - Priority: P1
  - Acceptance:
    - Admin-only, confirmation, audit, metadata cascade, dan file cleanup.
    - Delete satu part tidak menghapus part lain dalam batch.
  - Test:
    - Permission, batch sibling, attachment cleanup, dan audit test.

- [ ] TASK-049 - Implement admin delete Technical Report
  - Depends on: TASK-014, TASK-017, TASK-039, TASK-010
  - Priority: P1
  - Acceptance:
    - Admin-only, confirmation, audit, attachment cleanup, dan relational
      integrity.
    - Quality Issue terkait tetap valid.
  - Test:
    - Permission, relation integrity, dan file cleanup test.

- [ ] TASK-050 - Implement explicit rollback operations UI dan API
  - Depends on: TASK-023, TASK-030, TASK-014
  - Priority: P1
  - Acceptance:
    - UI tidak menawarkan rollback target yang tidak valid.
    - API menolak non-admin dan invalid target.
    - Rollback menulis from/to status, actor, timestamp, dan alasan optional.
  - Test:
    - E2E admin rollback dan forbidden non-admin.

- [ ] TASK-051 - Implement scheduled SQLite backup
  - Depends on: TASK-005, TASK-015
  - Priority: P1
  - Acceptance:
    - Default schedule mingguan dan dapat dikonfigurasi.
    - Backup memakai mekanisme SQLite-safe, bukan copy file aktif sembarang.
    - Backup mencakup database dan attachment.
    - Backup memiliki timestamp dan manifest.
  - Test:
    - Backup saat ada write activity dan verification manifest.

- [ ] TASK-052 - Implement backup retention dan integrity check
  - Depends on: TASK-051
  - Priority: P1
  - Acceptance:
    - Retention menyimpan N backup terbaru.
    - Backup corrupt atau tidak lengkap ditandai invalid.
    - Cleanup retention tidak menghapus backup valid terakhir secara tidak sengaja.
  - Test:
    - Retention count, corrupt DB, missing attachment, dan latest-valid backup.

- [ ] TASK-053 - Implement restore procedure dan smoke verification
  - Depends on: TASK-051, TASK-052, TASK-011
  - Priority: P1
  - Acceptance:
    - Restore mengembalikan database, attachment, schema, dan manifest.
    - Restore dilakukan ke target lokal yang terisolasi terlebih dahulu.
    - Migration check, auth check, record count, attachment open, dan critical
      smoke test dijalankan setelah restore.
    - Prosedur restore terdokumentasi dan repeatable.
  - Test:
    - Restore backup valid, invalid backup rejection, dan smoke test.

## 12. Testing dan Delivery

- [ ] TASK-054 - Unit test domain rules
  - Depends on: TASK-023, TASK-030, TASK-016, TASK-019
  - Priority: P0
  - Acceptance:
    - Quality Issue semua valid/invalid transition diuji.
    - Sample Defect semua valid/invalid transition diuji.
    - File policy, owner invariant, pagination, validation, dan authorization
      policy memiliki unit test.
  - Test:
    - `pnpm test:unit`.

- [ ] TASK-055 - Integration test persistence dan failure handling
  - Depends on: TASK-011, TASK-017, TASK-024, TASK-031, TASK-040
  - Priority: P0
  - Acceptance:
    - Quality Issue create -> database -> attachment diuji.
    - Batch 3 part success dan rollback diuji.
    - DB failure setelah file write menghapus file.
    - Migration dan FK behavior diuji dari database test terisolasi.
  - Test:
    - `pnpm test:integration`.

- [ ] TASK-056 - E2E critical Quality Issue flow
  - Depends on: TASK-028
  - Priority: P0
  - Acceptance:
    - Login -> create issue -> upload attachment -> detail -> add progress ->
      timeline -> status transition berhasil.
    - Error dan session-expired path memiliki coverage minimum.
  - Test:
    - `pnpm test:e2e -- quality-issue`.

- [ ] TASK-057 - E2E critical Sample Defect flow
  - Depends on: TASK-038
  - Priority: P0
  - Acceptance:
    - Login -> create 3 part -> verify all -> receive -> QRCC verification ->
      handover -> PQA analysis -> photo -> supplier analysis berhasil.
    - Batch partial failure tidak membuat data parsial.
  - Test:
    - `pnpm test:e2e -- sample-defect`.

- [ ] TASK-058 - E2E critical Technical Report flow
  - Depends on: TASK-042
  - Priority: P1
  - Acceptance:
    - Create report -> upload PDF -> upload XLSX -> link issue -> search ->
      detail berhasil.
    - Duplicate document number ditolak dengan feedback yang benar.
  - Test:
    - `pnpm test:e2e -- technical-report`.

- [ ] TASK-059 - Regression, accessibility, dan responsive verification
  - Depends on: TASK-028, TASK-038, TASK-042, TASK-044
  - Priority: P1
  - Acceptance:
    - Semua route utama memiliki loading, error, dan empty state.
    - Tidak ada console error pada critical flow.
    - Form dapat digunakan dengan keyboard dasar dan label yang benar.
    - UI usable pada desktop dan tablet minimum 768 px.
  - Test:
    - Browser regression dan accessibility smoke test.

- [ ] TASK-060 - Final build, migration, backup, dan release checklist
  - Depends on: TASK-053, TASK-054, TASK-055, TASK-056, TASK-057, TASK-058,
    TASK-059
  - Priority: P0
  - Acceptance:
    - Install, dev, build, preview, lint, format, typecheck, unit, integration,
      dan E2E pass.
    - Migration berhasil pada database kosong.
    - Backup integrity dan restore verification pass.
    - Dokumentasi operasional lokal tersedia.
    - Tidak ada issue P0/P1 terbuka yang memblokir MVP.
  - Test:
    - Full verification dari clean environment.

## 13. Global Definition of Done

Setiap task dianggap selesai hanya jika seluruh item yang relevan terpenuhi:

- [ ] Implementation mengikuti boundary API/service/repository.
- [ ] TypeScript strict check pass.
- [ ] Validation tersedia pada API boundary.
- [ ] Business rule berada di service.
- [ ] Authorization diperiksa server-side.
- [ ] Migration diperbarui jika schema berubah.
- [ ] Error handling dan response contract tersedia.
- [ ] Loading, error, empty, dan success state tersedia untuk UI task.
- [ ] Unit test tersedia untuk domain rule.
- [ ] Integration test tersedia untuk database/API/file lifecycle.
- [ ] E2E tersedia untuk critical user flow.
- [ ] Tidak ada orphan physical file dari failure path.
- [ ] Tidak ada console error pada flow terkait.
- [ ] Dokumentasi task dan keputusan teknis diperbarui bila diperlukan.

## 14. Dependency dan Urutan Delivery

```text
Foundation
  -> Database + Auth
  -> File + Shared Server Platform
  -> Quality Issue
  -> Sample Defect
  -> Technical Report
  -> Dashboard + Export
  -> Admin + Backup/Restore
  -> Full Testing + Hardening
```

Setelah TASK-011, modul Quality Issue dan Sample Defect dapat dikerjakan
paralel oleh developer berbeda, tetapi shared validation, error contract, file
policy, dan pagination harus disepakati lebih dahulu.

## 15. Risk Register

| Risk | Dampak | Mitigasi |
| --- | --- | --- |
| Arbitrary status string | High | Canonical constants dan service state machine |
| Partial sample batch | High | Satu transaction untuk seluruh part |
| Orphan physical file | High | Compensation dan reconciliation |
| Ambiguous attachment owner | High | Exactly-one-owner di DB dan service |
| Unauthorized rollback/delete | High | Server-side Admin policy |
| Inconsistent SQLite backup | High | SQLite-safe backup dan restore verification |
| Schema drift | Medium | Drizzle migration dari clean database |
| Slow large table/export | Medium | Index, server pagination, server-side export |
| Inconsistent UI behavior | Medium | Shared components dan composables |

## 16. Technical Debt yang Tidak Boleh Ditunda

- Status tidak boleh kembali menjadi free-form string.
- Attachment tidak boleh dibuat tanpa exactly one owner.
- File lifecycle tidak boleh bergantung pada cascade database saja.
- Batch sample tidak boleh memakai partial commit.
- Admin-only action tidak boleh hanya dilindungi oleh UI.
- Delete, rollback, dan status change harus dapat ditelusuri melalui audit.
- Backup tidak boleh dianggap valid tanpa integrity dan restore verification.
