# Public ID Contract

Dokumen ini mencatat kontrak tahap 1, schema tahap 2, backfill tahap 3,
generate ID pada jalur create tahap 4, dan response/type tahap 5 untuk public
ID domain utama.

## Format

| Entity | Prefix | Format |
| --- | --- | --- |
| Quality Issue | `QI-` | `QI-<uuid-v7>` |
| Sample Defect | `SD-` | `SD-<uuid-v7>` |
| Technical Report | `TR-` | `TR-<uuid-v7>` |

Prefix harus uppercase. UUID harus lowercase dalam format canonical UUIDv7.
Primary key integer dan foreign key tetap menjadi identifier internal.

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

List, detail, update, delete, dan state transition tetap menggunakan route serta
lookup `id` numeric. Tahap ini tidak menambahkan `findByPublicId` sebelum URL
public memang diperlukan.

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
aman dijalankan ulang; row yang sudah memiliki public ID tidak diubah.

## Batas Tahap 5

Tahap ini belum mengubah URL numeric atau tampilan UI. API create Sample Defect
dan Technical Report belum tersedia pada codebase saat ini; ketika service dan
response masing-masing ditambahkan, keduanya harus mempertahankan `id` numeric
dan menyertakan `publicId`.
