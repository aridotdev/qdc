# Database Schema

Dokumen ini adalah kontrak data canonical untuk MVP. Nama tabel dan kolom
menggunakan `snake_case`. Status disimpan sebagai kode uppercase; label yang
ditampilkan pada UI bukan nilai database.

## 1. Konvensi Umum

- Primary key domain memakai `integer` autoincrement.
- Timestamp memakai ISO 8601 UTC string.
- Tanggal bisnis tanpa waktu memakai format `YYYY-MM-DD`.
- Semua tabel domain memiliki `created_at`, `updated_at`,
  `created_by_user_id`, dan `updated_by_user_id`.
- Actor ID merujuk ke user ID Better-auth.
- FK domain harus mengaktifkan foreign key enforcement di SQLite.
- Auth tables dibuat dan dikelola oleh Better-auth; jangan menduplikasi schema
  auth di modul domain.
- Migration harus dapat dijalankan dari database SQLite kosong.

## 2. Quality Issue

Table: `quality_issues`

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID quality issue |
| issue_name | text | NOT NULL | Nama masalah |
| model_name | text | NOT NULL | Model produk |
| serial_number | text | NOT NULL | Nomor seri produk |
| tanggal_kejadian | text | NOT NULL | Format `YYYY-MM-DD` |
| notification_number | text | NULL | Nomor notifikasi cabang |
| detail | text | NULL | Deskripsi masalah |
| keterangan | text | NULL | Catatan tambahan |
| status | text | NOT NULL, DEFAULT `OPEN` | `OPEN`, `IN_PROGRESS`, `MONITORING`, `CLOSED` |
| created_at | text | NOT NULL | Timestamp audit |
| updated_at | text | NOT NULL | Timestamp audit |
| created_by_user_id | text | NOT NULL | Actor pembuat |
| updated_by_user_id | text | NOT NULL | Actor terakhir |

Indexes:

- `status`
- `notification_number`
- `model_name`
- `tanggal_kejadian`

Relasi:

- Parent dari `quality_issue_details`.
- Direferensikan optional oleh `sample_defects` dan `technical_reports`.

## 3. Quality Issue Detail

Table: `quality_issue_details`

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID timeline entry |
| issue_id | integer | NOT NULL, FK, ON DELETE CASCADE | Quality Issue parent |
| tanggal | text | NOT NULL | Timestamp progress |
| action | text | NOT NULL | Tindakan atau progress |
| remark | text | NULL | Catatan progress |
| created_at | text | NOT NULL | Timestamp audit |
| updated_at | text | NOT NULL | Timestamp audit |
| created_by_user_id | text | NOT NULL | Actor pembuat |
| updated_by_user_id | text | NOT NULL | Actor terakhir |

Indexes:

- `(issue_id, tanggal)`
- `tanggal`

Detail yang dibuat otomatis saat create untuk menampung attachment awal
menggunakan action `INITIAL_EVIDENCE`. Detail tersebut tetap terlihat sebagai
entry timeline.

## 4. Sample Defect

Table: `sample_defects`

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID record per part |
| batch_id | text | NOT NULL | Identitas satu request multi-part |
| issue_id | integer | NULL, FK, ON DELETE SET NULL | Relasi optional ke Quality Issue |
| notification_number | text | NOT NULL | Nomor notifikasi cabang |
| model_name | text | NOT NULL | Model |
| serial_number | text | NOT NULL | Nomor seri produk |
| cabang | text | NOT NULL | Nama cabang |
| part_number | text | NOT NULL | Nomor part |
| part_name | text | NOT NULL | Nama part |
| kerusakan_cabang | text | NOT NULL | Laporan kerusakan dari cabang |
| status | text | NOT NULL, DEFAULT `REQUESTED` | Kode state sample |
| tanggal_terima | text | NULL | Timestamp penerimaan fisik |
| keterangan_terima | text | NULL | Catatan penerimaan |
| nama_penerima_pqa | text | NULL | PIC PQA |
| tanggal_serah_pqa | text | NULL | Timestamp handover |
| kerusakan_verifikasi | text | NULL | Hasil verifikasi QRCC/PQA |
| kondisi_pqa | text | NULL | `NG` atau `NDF` |
| repair | text | NULL | Catatan repair |
| hasil_analisa_supplier | text | NULL | Ringkasan analisa supplier per part |
| created_at | text | NOT NULL | Timestamp audit |
| updated_at | text | NOT NULL | Timestamp audit |
| created_by_user_id | text | NOT NULL | Actor pembuat |
| updated_by_user_id | text | NOT NULL | Actor terakhir |

Canonical states:

```text
REQUESTED
RECEIVED
QRCC_VERIFIED
HANDED_OVER_TO_PQA
PQA_ANALYZED
SUPPLIER_ANALYZED
```

Indexes:

- `batch_id`
- `issue_id`
- `notification_number`
- `status`
- `(model_name, part_number)`

`batch_id` dibuat server-side sekali per request dan nilainya sama untuk semua
part pada request tersebut. `notification_number` boleh sama pada beberapa
batch dan bukan unique key.

## 5. Technical Report

Table: `technical_reports`

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID report |
| issue_id | integer | NULL, FK, ON DELETE SET NULL | Relasi optional |
| document_number | text | NOT NULL, UNIQUE | Nomor dokumen |
| document_type | text | NOT NULL | `TECHNICAL_REPORT` atau `SERVICE_TIPS` |
| release_date | text | NOT NULL | Format `YYYY-MM-DD` |
| model_name | text | NOT NULL | Model yang dibahas |
| issue_name | text | NOT NULL | Judul masalah |
| root_cause | text | NULL | Analisa akar masalah |
| action | text | NULL | Tindakan perbaikan |
| improvement_start_date | text | NULL | Cut-off tanggal perbaikan |
| improvement_start_serial_number | text | NULL | Cut-off nomor seri |
| document_reference | text | NULL | Referensi dokumen |
| keterangan | text | NULL | Catatan tambahan |
| created_at | text | NOT NULL | Timestamp audit |
| updated_at | text | NOT NULL | Timestamp audit |
| created_by_user_id | text | NOT NULL | Actor pembuat |
| updated_by_user_id | text | NOT NULL | Actor terakhir |

Indexes:

- unique `document_number`
- `issue_id`
- `document_type`
- `release_date`
- `model_name`

## 6. Attachment

Table: `attachments`

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID attachment |
| detail_id | integer | NULL, FK, ON DELETE CASCADE | Owner Quality Issue Detail |
| sample_id | integer | NULL, FK, ON DELETE CASCADE | Owner Sample Defect |
| report_id | integer | NULL, FK, ON DELETE CASCADE | Owner Technical Report |
| file_name | text | NOT NULL | Nama file asli dari user |
| storage_name | text | NOT NULL, UNIQUE | Nama fisik unik |
| file_url | text | NOT NULL | Logical URL `/uploads/...` |
| file_type | text | NOT NULL | MIME type canonical |
| file_size | integer | NOT NULL | Ukuran bytes |
| created_at | text | NOT NULL | Timestamp upload |
| updated_at | text | NOT NULL | Timestamp metadata |
| created_by_user_id | text | NOT NULL | Actor uploader |
| updated_by_user_id | text | NOT NULL | Actor terakhir |

Invariant owner wajib ditegakkan di service dan database:

```text
(detail_id IS NOT NULL) +
(sample_id IS NOT NULL) +
(report_id IS NOT NULL) = 1
```

Tidak boleh ada attachment tanpa owner atau dengan lebih dari satu owner.
Attachment awal Quality Issue memakai `detail_id` dari `INITIAL_EVIDENCE`.

Indexes:

- `detail_id`
- `sample_id`
- `report_id`
- `file_type`

## 7. Audit Log

Table: `audit_logs`

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID audit |
| entity_type | text | NOT NULL | Domain entity |
| entity_id | integer | NOT NULL | ID entity |
| action | text | NOT NULL | `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `ROLLBACK`, `UPLOAD` |
| from_status | text | NULL | Status sebelum perubahan |
| to_status | text | NULL | Status sesudah perubahan |
| metadata_json | text | NULL | Metadata non-sensitive |
| actor_user_id | text | NOT NULL | User pelaku |
| created_at | text | NOT NULL | Timestamp event |

Indexes:

- `(entity_type, entity_id, created_at)`
- `actor_user_id`
- `created_at`

Audit log bersifat append-only. Delete domain harus menulis event delete
sebelum operasi delete berhasil.

## 8. Referential Integrity dan Transaction

- `quality_issues -> quality_issue_details`: cascade delete.
- `quality_issues -> sample_defects`: set null.
- `quality_issues -> technical_reports`: set null.
- Detail/sample/report -> attachment: cascade metadata deletion.
- Penghapusan attachment harus menghapus physical file melalui service.
- Create Sample Defect batch memakai satu transaction. Jika satu part gagal,
  seluruh insert di-rollback.
- File write dan database insert bukan atomic; service wajib melakukan cleanup
  kompensasi.
- Status transition dan audit log ditulis dalam transaction yang sama.
