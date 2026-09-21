# QRCC Data Center — Technical Implementation Context

Konteks teknis ringkas untuk arsitektur, domain, API, UI, validasi, dan authorization.

Dokumen terkait:

* `task-list.md` — checklist task implementasi sederhana.
* `implementation-quality-delivery.md` — testing, acceptance criteria, risiko, technical debt, dan delivery checklist.

---

**Stack:** Nuxt 4 · Vue 3 · TypeScript Strict · Nuxt UI · Nitro · Drizzle ORM · SQLite · Better-auth · Zod · Vitest · pnpm

**Target:** Local server / localhost, single-user Admin/Personal

---

# 1. Arsitektur Implementasi

## 1.1 Layer Architecture

Implementasi menggunakan layered architecture:

```text
┌──────────────────────────────────────────────┐
│                  Nuxt UI                     │
│ Pages / Components / Composables             │
└──────────────────────┬───────────────────────┘
                       │ HTTP
┌──────────────────────▼───────────────────────┐
│              Nitro API Routes                │
│ Auth · Validation · HTTP Response             │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│                  Services                    │
│ Business Rules · Transactions · State Machine│
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│                Repositories                  │
│ Drizzle Queries · CRUD · Aggregation         │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│              SQLite / File System             │
└──────────────────────────────────────────────┘
```

PRD memang menetapkan API Route, Service, dan Repository sebagai layer terpisah.

---

# 2. Struktur Project

Baseline struktur yang disarankan:

```text
/
├── app/
│   ├── components/
│   │   ├── common/
│   │   ├── dashboard/
│   │   ├── quality-issue/
│   │   ├── sample-defect/
│   │   ├── technical-report/
│   │   └── attachment/
│   │
│   ├── composables/
│   │   ├── useAuth.ts
│   │   ├── useQualityIssues.ts
│   │   ├── useSampleDefects.ts
│   │   ├── useTechnicalReports.ts
│   │   ├── useAttachments.ts
│   │   └── usePagination.ts
│   │
│   ├── pages/
│   │   ├── index.vue
│   │   ├── login.vue
│   │   ├── quality-issues/
│   │   ├── sample-defects/
│   │   └── technical-reports/
│   │
│   └── layouts/
│
├── server/
│   ├── api/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── quality-issues/
│   │   ├── sample-defects/
│   │   ├── technical-reports/
│   │   ├── attachments/
│   │   ├── export/
│   │   └── backup/
│   │
│   ├── database/
│   │   ├── schema/
│   │   ├── migrations/
│   │   ├── client.ts
│   │   └── seed.ts
│   │
│   ├── repositories/
│   │   ├── qualityIssue.repo.ts
│   │   ├── qualityIssueDetail.repo.ts
│   │   ├── sampleDefect.repo.ts
│   │   ├── technicalReport.repo.ts
│   │   ├── attachment.repo.ts
│   │   └── dashboard.repo.ts
│   │
│   ├── services/
│   │   ├── qualityIssue.service.ts
│   │   ├── sampleDefect.service.ts
│   │   ├── technicalReport.service.ts
│   │   ├── attachment.service.ts
│   │   ├── dashboard.service.ts
│   │   ├── export.service.ts
│   │   └── backup.service.ts
│   │
│   ├── utils/
│   ├── validators/
│   └── middleware/
│
├── shared/
│   ├── constants/
│   ├── types/
│   └── validators/
│
├── public/
│   └── uploads/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── drizzle.config.ts
├── nuxt.config.ts
├── package.json
└── pnpm-lock.yaml
```

Catatan: folder dan nama file di atas adalah **target architecture**, bukan struktur yang sudah ada di project.

---

# 3. Database & Domain Model

## 3.1 Quality Issue

Entity:

```text
quality_issues
```

Fields utama mengikuti schema:

* id
* issue_name
* model_name
* serial_number
* tanggal_kejadian
* notification_number
* detail
* keterangan
* status

Schema saat ini menggunakan index pada status, notification number, dan model name.

### Status canonical

```text
OPEN
IN_PROGRESS
MONITORING
CLOSED
```

Mapping UI:

```text
Open
In Progress
Monitoring
Closed
```

Transition:

```text
OPEN
  ↓
IN_PROGRESS
  ↓
MONITORING
  ↓
CLOSED
```

Normal operation hanya forward.

Admin dapat melakukan rollback:

```text
CLOSED → MONITORING
MONITORING → IN_PROGRESS
IN_PROGRESS → OPEN
```

Service layer harus menjadi satu-satunya tempat yang menentukan valid/tidaknya transition.

---

# 4. Quality Issue Detail

Entity:

```text
quality_issue_details
```

Digunakan sebagai immutable-ish progress history:

* issue_id
* tanggal
* action
* remark

Schema sudah memiliki FK `issue_id` dengan cascade delete.

### Operation

```text
Create Progress
       ↓
Create Detail
       ↓
Upload attachments
       ↓
Return updated issue timeline
```

Progress tidak boleh langsung mengubah status tanpa business rule.

Contoh:

```text
addProgress()
    ↓
validate current status
    ↓
insert detail
    ↓
update issue status if applicable
```

---

# 5. Sample Defect State Machine

Canonical state:

```text
REQUESTED
   ↓
RECEIVED
   ↓
QRCC_VERIFIED
   ↓
HANDED_OVER_TO_PQA
   ↓
PQA_ANALYZED
   ↓
SUPPLIER_ANALYZED
```

UI labels:

```text
Diminta
Diterima
Diverifikasi QRCC
Diserahkan ke PQA
Analisa PQA
Analisa Supplier
```

### Forward transition

```text
REQUESTED → RECEIVED
RECEIVED → QRCC_VERIFIED
QRCC_VERIFIED → HANDED_OVER_TO_PQA
HANDED_OVER_TO_PQA → PQA_ANALYZED
PQA_ANALYZED → SUPPLIER_ANALYZED
```

### Admin rollback

Admin dapat melakukan:

```text
RECEIVED → REQUESTED
QRCC_VERIFIED → RECEIVED
HANDED_OVER_TO_PQA → QRCC_VERIFIED
PQA_ANALYZED → HANDED_OVER_TO_PQA
SUPPLIER_ANALYZED → PQA_ANALYZED
```

Implementasikan transition sebagai explicit business operation, bukan:

```text
updateSample({ status: "..." })
```

lebih aman secara konsep:

```text
receiveSample()
verifySample()
handoverToPqa()
completePqaAnalysis()
completeSupplierAnalysis()
rollbackSampleStatus()
```

---

# 6. Sample Defect Batch Transaction

`Request New Sample` dapat membuat beberapa part sekaligus.

Requirement yang sudah dikonfirmasi:

> seluruh part dalam satu request wajib dianggap satu transaction.

Implementasi:

```text
POST /sample-defects/batch

BEGIN TRANSACTION

  validate request
  validate all parts
  insert part #1
  insert part #2
  insert part #3
  ...

COMMIT
```

Jika satu part gagal:

```text
ROLLBACK
```

Tidak boleh menghasilkan partial batch.

---

# 7. Technical Report

Entity:

```text
technical_reports
```

Fields mengikuti database:

* document_number
* document_type
* release_date
* model_name
* issue_name
* root_cause
* action
* improvement_start_date
* improvement_start_serial_number
* document_reference
* keterangan
* optional issue_id

`document_number` harus unique sesuai schema.

Document type:

```text
TECHNICAL_REPORT
SERVICE_TIPS
```

---

# 8. Attachment Architecture

Attachment mendukung:

```text
JPG
JPEG
PNG
PDF
DOCX
XLSX
MP4 / video
```

Limit:

```text
Image/document/PDF = 1 MB
Video = 10 MB
```

Attachment dapat dimiliki oleh:

```text
QualityIssueDetail
SampleDefect
TechnicalReport
```

Schema existing menggunakan tiga FK optional.

Service harus menjamin:

```text
exactly one owner
```

Tidak boleh:

```text
detail_id = null
sample_id = null
report_id = null
```

atau lebih dari satu owner sekaligus.

---

# 9. File Storage Strategy

Original filename disimpan sebagai metadata.

Physical filename menggunakan generated unique identifier.

Contoh konsep:

```text
/uploads/
  2026/
    09/
      22/
        uuid.jpg
```

Database:

```text
file_name = "IMG_1234.jpg"
file_url  = "/uploads/2026/09/22/uuid.jpg"
```

Tujuan:

* mencegah filename collision
* mencegah overwrite
* menghindari masalah karakter filename
* memisahkan logical filename dengan physical storage

---

# 10. File + Database Failure Handling

Upload operation tidak boleh diasumsikan atomic.

Flow:

```text
Validate file
    ↓
Generate storage filename
    ↓
Write file
    ↓
Insert attachment metadata
```

Jika DB insert gagal:

```text
delete physical file
```

Jika file write gagal:

```text
do not insert attachment
```

Jika batch memiliki beberapa file, cleanup harus dilakukan terhadap file-file yang sudah berhasil ditulis apabila transaction akhirnya gagal.

---

# 11. API Breakdown

## Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

Better-auth tetap menjadi implementation provider.

---

# 12. Quality Issue API

```text
GET    /api/quality-issues
POST   /api/quality-issues

GET    /api/quality-issues/:id
PATCH  /api/quality-issues/:id
DELETE /api/quality-issues/:id

POST   /api/quality-issues/:id/details
GET    /api/quality-issues/:id/details

POST   /api/quality-issues/:id/attachments
```

Tambahkan operation khusus transition:

```text
POST /api/quality-issues/:id/status
```

daripada membolehkan arbitrary status melalui generic PATCH.

---

# 13. Sample Defect API

```text
GET  /api/sample-defects
POST /api/sample-defects

POST /api/sample-defects/batch

GET  /api/sample-defects/:id
PATCH /api/sample-defects/:id
DELETE /api/sample-defects/:id
```

State operations:

```text
POST /api/sample-defects/:id/receive
POST /api/sample-defects/:id/verify
POST /api/sample-defects/:id/handover
POST /api/sample-defects/:id/pqa-analysis
POST /api/sample-defects/:id/supplier-analysis

POST /api/sample-defects/:id/rollback
```

`rollback` wajib melakukan admin authorization.

---

# 14. Technical Report API

```text
GET    /api/technical-reports
POST   /api/technical-reports

GET    /api/technical-reports/:id
PATCH  /api/technical-reports/:id
DELETE /api/technical-reports/:id

POST /api/technical-reports/:id/attachments
```

Search/filter:

```text
document_number
document_type
model_name
issue_id
release_date
```

---

# 15. Dashboard API

```text
GET /api/dashboard/summary
GET /api/dashboard/quality-issues
GET /api/dashboard/sample-defects
```

Dashboard service bertanggung jawab terhadap aggregation query.

Jangan mengambil seluruh tabel ke frontend lalu menghitung KPI di browser.

---

# 16. Attachment API

```text
GET    /api/attachments/:id
DELETE /api/attachments/:id
```

Upload dilakukan melalui endpoint domain masing-masing sehingga ownership attachment jelas.

Contoh:

```text
POST /api/quality-issues/:id/attachments
POST /api/sample-defects/:id/attachments
POST /api/technical-reports/:id/attachments
```

---

# 17. Frontend Pages

## Authentication

```text
/login
```

---

## Dashboard

```text
/
```

Components:

```text
DashboardKpiCards
QualityIssueStatusChart
SampleDefectTrendChart
RecentQualityIssues
RecentSampleDefects
RecentTechnicalReports
```

---

# 18. Quality Issue UI

Pages:

```text
/quality-issues
/quality-issues/new
/quality-issues/[id]
```

Components:

```text
QualityIssueTable
QualityIssueFilters
QualityIssueForm
QualityIssueDetail
QualityIssueStatusBadge
QualityIssueTimeline
QualityIssueProgressForm
AttachmentUploader
AttachmentList
```

### Create flow

```text
Open form
 ↓
Input master data
 ↓
Select attachments
 ↓
Validate
 ↓
Submit
 ↓
Create Quality Issue
 ↓
Upload attachments
 ↓
Redirect detail
```

Attachment sudah dikonfirmasi boleh dilakukan langsung ketika create.

---

# 19. Sample Defect UI

Pages:

```text
/sample-defects
/sample-defects/new
/sample-defects/[id]
```

Components:

```text
SampleDefectTable
SampleDefectFilters
SampleDefectBatchForm
SampleDefectRow
SampleDefectStatusBadge
SampleDefectActionMenu
PqaAnalysisForm
SupplierAnalysisForm
AttachmentUploader
```

Batch form:

```text
Request
 ├── notification
 ├── model
 ├── cabang
 └── parts[]
       ├── part number
       ├── part name
       └── kerusakan
```

Validation harus terjadi sebelum transaction dimulai.

---

# 20. Technical Report UI

Pages:

```text
/technical-reports
/technical-reports/new
/technical-reports/[id]
```

Components:

```text
TechnicalReportTable
TechnicalReportFilters
TechnicalReportForm
TechnicalReportTypeBadge
TechnicalReportDetail
AttachmentUploader
AttachmentList
```

Create form mendukung:

```text
metadata
PDF
XLSX
optional Quality Issue
```

---

# 21. Shared Components

Komponen reusable:

```text
AppTable
AppPagination
AppSearchInput
AppDatePicker
AppFilterBar
AppConfirmDialog
AppFileUploader
AppFileList
AppEmptyState
AppErrorState
AppLoadingState
AppStatusBadge
AppToast
```

Tujuan utama adalah mencegah tiga modul membuat implementasi table/filter/upload yang berbeda-beda.

---

# 22. State Management

Untuk MVP, hindari global state besar.

Gunakan:

```text
composables
```

untuk server state dan UI state sederhana.

Contoh:

```text
useQualityIssues()
useSampleDefects()
useTechnicalReports()
useDashboard()
```

Pagination/filter state dapat berada di URL query:

```text
/quality-issues?
  page=1
  &limit=20
  &search=ABC
  &status=OPEN
```

Keuntungan:

* URL shareable
* refresh tidak kehilangan filter
* browser back/forward bekerja
* server-side pagination lebih mudah

---

# 23. Validation

Zod digunakan di API boundary sesuai requirement PRD.

Schema validation:

```text
createQualityIssueSchema
updateQualityIssueSchema

createProgressSchema

createSampleDefectSchema
createSampleDefectBatchSchema

pqaAnalysisSchema
supplierAnalysisSchema

createTechnicalReportSchema

fileUploadSchema
paginationSchema
filterSchema
```

Validation dilakukan:

```text
HTTP input
    ↓
Zod
    ↓
Service
```

Business validation tetap berada di service.

---

# 24. Authorization

Walaupun single-user, operasi destructive dan rollback harus memiliki authorization check.

Minimum:

```text
READ       → authenticated
CREATE     → authenticated
UPDATE     → authenticated
DELETE     → admin
ROLLBACK   → admin
```

Status transition forward:

```text
authenticated user
```

Status transition backward:

```text
admin only
```

---
