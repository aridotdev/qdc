# QRCC Data Center — Quality, Risk, and Delivery

Konteks untuk testing, acceptance criteria, definition of done, prioritas, risiko, technical debt, dan delivery akhir.

Dokumen terkait:

* `implementation-plan.md` — konteks teknis arsitektur/domain/API/UI.
* `task-list.md` — checklist task implementasi sederhana.

---

# Compact Task Acceptance Summary

Ringkasan ini menjaga acceptance utama dari sprint breakdown tanpa membawa
uraian panjang ke dalam `task-list.md`.

## Foundation

- `TASK-001`: Nuxt 4, TypeScript strict, pnpm, dev, dan build berjalan.
- `TASK-002`: Nuxt UI, base layout, dan theme dasar tersedia.
- `TASK-003`: formatting, lint, type check, dan verification command tersedia.
- `TASK-004`: SQLite, Drizzle connection, migration, dan reset database tersedia.
- `TASK-005`: seluruh schema domain dan relasinya tersedia.
- `TASK-006`: index, unique constraint, dan attachment owner validation tersedia.
- `TASK-007`: audit fields dan actor tracking sesuai auth model.
- `TASK-008`: login, password hashing, session expiry, dan logout berjalan.
- `TASK-009`: route/API terlindungi dan session dapat diverifikasi server-side.
- `TASK-010`: file tersimpan di `/uploads` dengan nama fisik unik.
- `TASK-011`: tipe file dan batas ukuran divalidasi sebelum penyimpanan.
- `TASK-012`: exactly-one-owner, metadata, physical file, dan cleanup berjalan.

## Quality Issue

- `TASK-013`: repository mendukung CRUD, pagination, search, filter, dan sorting.
- `TASK-014`: service menerapkan business rule, transition, rollback, dan transaction.
- `TASK-015`: API memvalidasi input, attachment, error HTTP, dan orphan cleanup.
- `TASK-016`: list UI memiliki table, search, filter, pagination, dan state lengkap.
- `TASK-017`: create UI memvalidasi field dan file lalu redirect ke detail.
- `TASK-018`: detail, timeline, progress, attachment, dan status transition berjalan.

## Sample Defect

- `TASK-019`: repository mendukung pagination, filter, search, sorting, detail, dan CRUD.
- `TASK-020`: hanya forward transition valid; rollback hanya untuk admin.
- `TASK-021`: batch multi-part atomic; satu kegagalan me-rollback seluruh batch.
- `TASK-022`: receive hanya dari `REQUESTED` dan menyimpan data penerimaan.
- `TASK-023`: QRCC verification hanya dari `RECEIVED`.
- `TASK-024`: handover memerlukan PIC PQA dan timestamp.
- `TASK-025`: PQA analysis menyimpan hasil, repair, dan attachment foto.
- `TASK-026`: supplier analysis dapat disimpan per part dan mengubah status final.
- `TASK-027`: UI hanya menampilkan action sesuai state; backend tetap memvalidasi.

## Technical Report, Dashboard, and Export

- `TASK-028`: repository CRUD, search/filter, pagination, dan unique document number.
- `TASK-029`: document type, relasi Quality Issue, dan duplicate number tervalidasi.
- `TASK-030`: metadata, PDF, XLSX, dan relasi optional tersimpan benar.
- `TASK-031`: list, form, detail, search/filter, dan attachment tersedia.
- `TASK-032`: dashboard menyediakan KPI, status summary, trend, dan recent records.
- `TASK-033`: dashboard memiliki loading state dan aman ketika data kosong.
- `TASK-034`: pagination server-side dengan page size dan total count.
- `TASK-035`: Excel mendukung full/filtered export dan timestamped filename.
- `TASK-036`: PDF mendukung full/filtered export dan dapat dibuka standar.

## Admin, Backup, and Reliability

- `TASK-037`: delete Quality Issue admin-only, confirmation, cascade, dan file cleanup.
- `TASK-038`: delete Sample Defect admin-only dengan attachment cleanup dan audit.
- `TASK-039`: delete Technical Report admin-only dengan relational integrity.
- `TASK-040`: admin dapat rollback hanya ke transition yang valid dan tercatat.
- `TASK-041`: backup mingguan konsisten, bertimestamp, dan tidak mengganggu aplikasi.
- `TASK-042`: retention backup configurable dan menyimpan N backup terbaru.
- `TASK-043`: integrity check membedakan backup valid dan corrupt.
- `TASK-044`: prosedur restore mencakup database, attachment, schema, dan smoke test.

---

# 33. Sprint 11 — Testing

## Unit Tests

### Domain rules yang wajib diuji

#### Quality Issue

```text
OPEN → IN_PROGRESS       valid
IN_PROGRESS → MONITORING valid
MONITORING → CLOSED      valid

OPEN → CLOSED            invalid
CLOSED → OPEN            admin only
```

#### Sample Defect

```text
REQUESTED → RECEIVED
RECEIVED → QRCC_VERIFIED
QRCC_VERIFIED → HANDED_OVER_TO_PQA
HANDED_OVER_TO_PQA → PQA_ANALYZED
PQA_ANALYZED → SUPPLIER_ANALYZED
```

Semua invalid transition harus diuji.

---

# 34. Integration Tests

Wajib menguji:

### Quality Issue creation

```text
request
 ↓
validation
 ↓
database
 ↓
attachment
```

### Sample batch

```text
3 parts
 ↓
transaction
 ↓
all inserted
```

dan:

```text
part #3 fails
 ↓
rollback part #1
rollback part #2
```

### Attachment failure

```text
file saved
 ↓
DB fails
 ↓
file cleanup
```

---

# 35. E2E Critical User Flows

Minimal E2E:

## Flow A — Quality Issue

```text
Login
 ↓
Create Quality Issue
 ↓
Upload attachment
 ↓
Open detail
 ↓
Add progress
 ↓
Verify timeline
 ↓
Change status
```

---

## Flow B — Sample Defect

```text
Login
 ↓
Create 3 sample parts
 ↓
Verify all created
 ↓
Receive
 ↓
QRCC Verification
 ↓
Handover PQA
 ↓
PQA Analysis
 ↓
Upload photo
 ↓
Supplier Analysis
```

---

## Flow C — Technical Report

```text
Login
 ↓
Create Technical Report
 ↓
Upload PDF
 ↓
Upload XLSX
 ↓
Link Quality Issue
 ↓
Search report
 ↓
Open detail
```

---

# 36. Testing Matrix

| Area                     | Unit | Integration | E2E |
| ------------------------ | ---: | ----------: | --: |
| Auth                     |    ✓ |           ✓ |   ✓ |
| Quality Issue validation |    ✓ |           ✓ |   ✓ |
| Quality Issue status     |    ✓ |           ✓ |   ✓ |
| Progress                 |    ✓ |           ✓ |   ✓ |
| Sample state machine     |    ✓ |           ✓ |   ✓ |
| Batch transaction        |    ✓ |           ✓ |   ✓ |
| PQA analysis             |    ✓ |           ✓ |   ✓ |
| Supplier analysis        |    ✓ |           ✓ |   ✓ |
| Technical Report         |    ✓ |           ✓ |   ✓ |
| Attachment validation    |    ✓ |           ✓ |   ✓ |
| File cleanup             |    ✓ |           ✓ |   - |
| Dashboard aggregation    |    ✓ |           ✓ |   ✓ |
| Export                   |    ✓ |           ✓ |   ✓ |
| Backup                   |    ✓ |           ✓ |   - |
| Admin rollback           |    ✓ |           ✓ |   ✓ |
| Admin delete             |    ✓ |           ✓ |   ✓ |

---

# 37. Acceptance Criteria Global

A feature dianggap selesai apabila:

1. TypeScript tidak menghasilkan error.
2. Zod validation tersedia pada API boundary.
3. Authentication/authorization sesuai requirement.
4. Business logic berada di service.
5. Database access berada di repository.
6. Tidak ada direct database query dari UI.
7. Loading/error/empty state tersedia.
8. Critical business rule memiliki unit test.
9. Critical workflow memiliki integration/E2E test.
10. File operation memiliki cleanup strategy.
11. Migration dapat dijalankan dari clean database.
12. Production/local build berhasil.

---

# 38. Definition of Done

Untuk setiap Jira task:

```text
[ ] Implementation selesai
[ ] TypeScript check pass
[ ] Lint/format pass
[ ] Migration updated jika diperlukan
[ ] Validation implemented
[ ] Error handling implemented
[ ] Authorization checked
[ ] Unit test jika business rule
[ ] Integration test jika database/API
[ ] UI state lengkap
[ ] Manual smoke test
[ ] Tidak ada orphan file
[ ] Tidak ada console error
```

---

# 39. Prioritas Implementasi

Prioritas keseluruhan:

```text
P0 — Foundation
 ├── Nuxt
 ├── pnpm
 ├── TypeScript
 ├── SQLite
 ├── Drizzle
 └── Better-auth

P0 — Core Infrastructure
 ├── Validation
 ├── Repository
 ├── Service
 ├── File storage
 └── Attachment

P0 — Business Critical
 ├── Quality Issue
 └── Sample Defect

P1 — Supporting Business Module
 └── Technical Report

P1 — Visibility
 └── Dashboard

P1 — Productivity
 └── Search/filter/export

P1 — Reliability
 ├── Backup
 └── Restore

P2 — Refinement
 ├── UX improvement
 ├── performance tuning
 └── additional reporting
```

---

# 40. Dependency Graph

```text
Project Foundation
        │
        ▼
Database + Migration
        │
        ├───────────────┐
        ▼               ▼
Authentication     File Storage
        │               │
        └───────┬───────┘
                ▼
        Shared Validation
                │
        ┌───────┴────────┐
        ▼                ▼
 Quality Issue      Sample Defect
        │                │
        └───────┬────────┘
                ▼
        Technical Report
                │
                ▼
            Dashboard
                │
                ▼
        Export / Reporting
                │
                ▼
       Backup / Reliability
                │
                ▼
       Integration / E2E Test
                │
                ▼
              Build
```

---

# 41. Recommended Development Order per Developer Team

Jika dikerjakan oleh satu developer:

```text
Week/Iteration 1
Foundation + DB + Auth

Week/Iteration 2
File + Attachment + Quality Issue

Week/Iteration 3
Sample Defect + State Machine

Week/Iteration 4
Technical Report + Dashboard

Week/Iteration 5
Export + Backup + Admin operations

Week/Iteration 6
Testing + Performance + Build + Hardening
```

Jika dikerjakan beberapa developer, setelah Foundation selesai pekerjaan dapat diparalelkan:

```text
                Foundation
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       Quality    Sample     Technical
       Issue      Defect     Report
          │         │         │
          └─────────┼─────────┘
                    ▼
                Dashboard
                    │
             Export/Backup
```

Tetapi **shared infrastructure harus diselesaikan lebih dulu** untuk mencegah setiap developer membuat versi upload, validation, pagination, dan error handling sendiri.

---

# 42. Risiko Teknis dan Mitigasi

| Risiko                      | Dampak | Mitigasi                      |
| --------------------------- | ------ | ----------------------------- |
| Status arbitrary string     | High   | State machine di service      |
| Partial batch insert        | High   | DB transaction                |
| Orphan files                | High   | File cleanup strategy         |
| Attachment owner ambiguity  | High   | Exactly-one-owner validation  |
| Unauthorized rollback       | High   | Server-side admin check       |
| Unauthorized delete         | High   | Server-side admin check       |
| SQLite backup inconsistency | High   | SQLite-safe backup mechanism  |
| File requirement mismatch   | Medium | Central file policy           |
| Large table                 | Medium | Server pagination + index     |
| Export heavy query          | Medium | Server-side export            |
| Dashboard slow              | Medium | Dedicated aggregation queries |
| Schema drift                | Medium | Drizzle migrations            |
| Inconsistent UI             | Medium | Shared components             |

---

# 43. Technical Debt Register

Technical debt yang **tidak boleh sengaja ditunda**:

### TD-001 — Status string

Harus memiliki canonical constants/type dan transition rules.

### TD-002 — Attachment ownership

Harus memiliki exactly-one-owner invariant.

### TD-003 — File lifecycle

Delete DB harus memiliki strategy terhadap physical file.

### TD-004 — Business transaction

Batch sample harus atomic.

### TD-005 — Authorization

Admin-only operation harus diverifikasi server-side.

### TD-006 — Audit

Create/update/delete/rollback harus memiliki timestamp yang dapat ditelusuri.

### TD-007 — Backup

Backup bukan sekadar copy file SQLite biasa; harus ada integrity dan restore verification.

---

# 44. Final Delivery Checklist

Sebelum aplikasi dinyatakan siap digunakan:

```text
Infrastructure
[ ] pnpm install
[ ] pnpm dev
[ ] pnpm build
[ ] pnpm preview

Database
[ ] Migration
[ ] Seed
[ ] FK
[ ] Index
[ ] Audit fields

Authentication
[ ] Login
[ ] Logout
[ ] Session expiration
[ ] Protected API

Quality Issue
[ ] CRUD
[ ] Search
[ ] Filter
[ ] Progress
[ ] Status
[ ] Attachment
[ ] Admin rollback
[ ] Admin delete

Sample Defect
[ ] Batch request
[ ] Transaction
[ ] Receive
[ ] QRCC verification
[ ] PQA handover
[ ] PQA analysis
[ ] Supplier analysis
[ ] Attachment
[ ] Admin rollback
[ ] Admin delete

Technical Report
[ ] CRUD
[ ] Search
[ ] Filter
[ ] PDF
[ ] XLSX
[ ] Quality Issue relation
[ ] Admin delete

Dashboard
[ ] KPI
[ ] Status summary
[ ] Sample trend

Export
[ ] Full export
[ ] Filtered export
[ ] Excel
[ ] PDF

Reliability
[ ] Weekly backup
[ ] Retention
[ ] Integrity check
[ ] Restore procedure

Testing
[ ] Unit
[ ] Integration
[ ] E2E
[ ] Regression

Final
[ ] Build
[ ] Local server
[ ] Documentation
[ ] Backup verified
[ ] Restore verified
```

# 45. Hasil Akhir yang Diharapkan

Setelah seluruh task selesai, aplikasi akan memiliki alur operasional:

```text
                    ┌──────────────┐
                    │     LOGIN    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   DASHBOARD  │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
      Quality Issue   Sample Defect   Technical
                                     Report
             │             │             │
             │             │             │
             ▼             ▼             ▼
         Progress       State Flow      Archive
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                     Attachments
                           │
                           ▼
                    Search / Filter
                           │
                           ▼
                       Export
                           │
                           ▼
                    Weekly Backup
```

Dengan desain ini, business logic utama tidak tersebar di UI maupun API route. State machine, transaction, attachment lifecycle, authorization, dan database access memiliki boundary masing-masing. Hal tersebut juga menjaga implementasi tetap sesuai dengan prinsip maintainability yang ditetapkan PRD: TypeScript strict, modular components, Drizzle migration, Zod validation, dan pemisahan API/service/repository.
