# Public ID Contract

Dokumen ini mencatat kontrak tahap 1, schema tahap 2, dan backfill tahap 3
untuk public ID domain utama.

## Format

| Entity | Prefix | Format |
| --- | --- | --- |
| Quality Issue | `QI-` | `QI-<uuid-v7>` |
| Sample Defect | `SD-` | `SD-<uuid-v7>` |
| Technical Report | `TR-` | `TR-<uuid-v7>` |

Prefix harus uppercase. UUID harus lowercase dalam format canonical UUIDv7.
Primary key integer dan foreign key tetap menjadi identifier internal.

## Implementasi Tahap 1

- Dependency: `uuid`, menggunakan API `v7()`.
- Generator server-side: [server/utils/public-id.ts](../server/utils/public-id.ts).
- Entity dan prefix: [shared/constants/public-id.ts](../shared/constants/public-id.ts).
- Validator: [shared/validators/public-id.ts](../shared/validators/public-id.ts).
- Kolom database final: `text NOT NULL` dengan unique index bernama per entity.
- Input create/update client tidak menerima `public_id`; schema Drizzle akan
  menghapus `publicId` dari kontrak insert/update.

Generator tidak menerima timestamp dari client dan tidak memiliki retry loop.
Insert server yang tidak memberikan `publicId` memakai runtime default function
untuk membuat UUIDv7 sebelum SQL dikirim. Ini bukan default SQL database.

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

## Batas Tahap 3

Tahap ini belum mengubah response domain, query repository public ID, URL
numeric, atau tampilan UI.
