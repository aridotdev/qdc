# Public ID Contract

Dokumen ini mencatat kontrak tahap 1, schema tahap 2, backfill tahap 3,
generate ID pada jalur create tahap 4, response/type tahap 5, pemakaian UI
tahap 6, migrasi URL tahap 7, dan business/display ID domain utama.

## Format

| Entity | Prefix | Format |
| --- | --- | --- |
| Quality Issue | `QI-` | `QI-<uuid-v7>` |
| Sample Defect | `SD-` | `SD-<uuid-v7>` |
| Technical Report | `TR-` | `TR-<uuid-v7>` |

Prefix harus uppercase. UUID harus lowercase dalam format canonical UUIDv7.
Primary key integer dan foreign key tetap menjadi identifier internal.
Public ID adalah identifier opaque untuk URL/API, bukan nomor operasional yang
ditampilkan sebagai ID utama di tabel.

## Business ID Operasional

| Entity | Format |
| --- | --- |
| Quality Issue | `QI-yyyymmdd-xxx` |
| Sample Defect | `SD-yyyymmdd-xxx` |
| Technical Report | `TR-yyyymmdd-xxx` |

`xxx` adalah sequence tiga digit yang reset per hari dan per entity.
Sequence disimpan sederhana di tabel `business_id_counters` dengan primary key
`(entity, business_date)`. `public_id` UUIDv7 yang sudah dibuat tidak diubah.

Quality Issue service membuat `businessId` dalam transaction sebelum insert.
Development seed mengisi `businessId` untuk Quality Issue, Sample Defect, dan
Technical Report. Migration menambahkan backfill dan trigger fallback untuk
direct insert server/fixture yang tidak mengirim `business_id`.

Input create/update client tidak menerima `businessId`. Shared domain type
memakai field canonical `business_id`, sedangkan response server/frontend yang
sudah camelCase memakai `businessId`.

## Implementasi Tahap 1 dan 4

- Dependency: `uuid`, menggunakan API `v7()`.
- Generator server-side: [server/utils/public-id.ts](../server/utils/public-id.ts).
- Entity dan prefix: [shared/constants/public-id.ts](../shared/constants/public-id.ts).
- Validator: [shared/validators/public-id.ts](../shared/validators/public-id.ts).
- Kolom database final: `text NOT NULL` dengan unique index bernama per entity.
- Input create/update client tidak menerima `public_id`; schema Drizzle akan
  menghapus `publicId` dari kontrak insert/update.

Generator tidak menerima timestamp dari client dan tidak memiliki retry loop.
Quality Issue service dan development seed memberikan `publicId` secara
eksplisit sebelum insert. Seed juga mengisi Sample Defect dan Technical Report
dengan generator yang sama.

Insert server yang belum memiliki service/repository khusus, termasuk direct
insert pada fixture, memakai runtime default function untuk membuat UUIDv7
sebelum SQL dikirim. Ini bukan default SQL database. Setiap pemanggilan insert
mendapat nilai baru, sehingga part dalam batch yang sama tidak berbagi ID.
Tidak ada jalur client yang dapat mengirim atau mengubah `publicId`.

## Response dan Type Tahap 5

Response domain yang berasal dari row database mempertahankan `id` numeric dan
menyertakan `publicId`. Response create Quality Issue mempertahankan
`issueId` numeric untuk kompatibilitas dan menambahkan `publicId`.

`shared/types/domain.ts` menambahkan `public_id` pada type Quality Issue, Sample
Defect, dan Technical Report karena type domain canonical menggunakan
`snake_case`. Tipe frontend yang sudah menerima response Quality Issue memakai
`publicId`, mengikuti bentuk response server yang sudah menggunakan `camelCase`.

List, detail, update, delete, dan state transition tetap menjaga `id` numeric
di response serta relasi internal. URL public dibahas pada Tahap 7.

## Pemakaian UI Tahap 6

List Quality Issue menampilkan `businessId` sebagai ID operasional dengan
fallback `id` numeric untuk row lama. Create Quality Issue menampilkan
`businessId` pada toast sukses, dengan fallback `publicId` bila business ID
belum tersedia. Route row dan redirect create tetap memakai `publicId` setelah
migrasi URL tahap 7.

Export dan halaman detail belum tersedia pada codebase saat ini. Sample Defect
dan Technical Report juga belum memiliki list/detail UI yang menerima data
domain, sehingga tidak ada identifier internal yang perlu ditampilkan di sana.

## Migrasi URL Tahap 7

Repository Quality Issue menyediakan `findByPublicId`. Semua endpoint Quality
Issue yang memakai parameter `[id]` menerima dua format:

- ID numeric lama, misalnya `/api/quality-issues/42`;
- public ID baru, misalnya `/api/quality-issues/QI-<uuid-v7>`.

Public ID divalidasi dengan prefix `QI-` dan UUIDv7 canonical, lalu di-lookup
menjadi `id` integer sebelum service, relasi, audit log, dan attachment
dijalankan. Prefix salah, UUID invalid, dan public ID yang tidak ditemukan
menghasilkan error API yang sesuai. Numeric ID lama tetap didukung.

Link list dan redirect create Quality Issue sekarang memakai `publicId`,
meskipun kolom ID pada tabel menampilkan `businessId`.
Route Sample Defect dan Technical Report tidak dimigrasikan karena belum ada
halaman atau API domain yang membutuhkan public URL.

## Backfill Tahap 3

Migration menambahkan `public_id` sebagai kolom nullable terlebih dahulu karena
SQLite tidak dapat menambahkan kolom `NOT NULL` ke tabel yang sudah memiliki
data tanpa nilai pengisi. Unique index tetap dibuat sejak awal karena SQLite
mengizinkan beberapa nilai `NULL` pada unique index.

Jalankan backfill dengan:

```bash
pnpm db:backfill-public-id
```

Command tersebut menjalankan migration, mengisi row `NULL` dalam urutan
`quality_issues`, `sample_defects`, lalu `technical_reports`, memvalidasi
prefix/UUID/duplicate, dan rebuild tabel untuk menegakkan `NOT NULL`. Command
aman dijalankan ulang; row yang sudah memiliki public ID tidak diubah. Saat
rebuild, command mempertahankan index dan trigger tabel, termasuk trigger
fallback `business_id`.

## Batas Tahap 7

Tahap ini belum mengubah primary key, foreign key, audit log, atau response
numeric internal. Halaman detail frontend Quality Issue belum tersedia pada
codebase saat ini; endpoint detail dan action sudah menerima public URL.
API create Sample Defect dan Technical Report juga belum tersedia; ketika UI
masing-masing ditambahkan, identifier yang ditampilkan harus memakai
`businessId`, sementara URL/API publik tetap memakai `publicId` dan `id` tetap
internal.
