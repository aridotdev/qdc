# Public ID Contract

Dokumen ini mencatat kontrak tahap 1 untuk public ID domain utama. Implementasi
persistence database dan backfill belum termasuk dalam tahap ini.

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
- Input create/update client tidak menerima `public_id`; schema strict akan
  menolak field tersebut.

Generator tidak menerima timestamp dari client dan tidak memiliki retry loop.
Public ID baru dibuat saat jalur create server diimplementasikan pada tahap
generate ID berikutnya.

## Batas Tahap 1

Tahap ini belum mengubah schema, migration, seed, response domain, query
repository, URL numeric, atau tampilan UI. Perubahan tersebut harus dilakukan
setelah persistence dan backfill tervalidasi.
