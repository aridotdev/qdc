# Public ID Contract

Dokumen ini mencatat kontrak tahap 1 dan schema tahap 2 untuk public ID domain
utama. Backfill database existing belum termasuk dalam tahap ini.

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
- Kolom database: `text NOT NULL` dengan unique index bernama per entity.
- Input create/update client tidak menerima `public_id`; schema Drizzle akan
  menghapus `publicId` dari kontrak insert/update.

Generator tidak menerima timestamp dari client dan tidak memiliki retry loop.
Insert server yang tidak memberikan `publicId` memakai runtime default function
untuk membuat UUIDv7 sebelum SQL dikirim. Ini bukan default SQL database.

## Batas Tahap 1

Tahap ini belum mengubah response domain, query repository public ID, URL
numeric, atau tampilan UI. Migration pada database existing tetap menunggu
backfill dan rebuild SQLite pada tahap berikutnya.
