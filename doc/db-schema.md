# Database Schema

## 1. QualityIssue

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID Quality Issue |
| issue_name | text | NOT NULL | Judul / Nama masalah |
| model_name | text | NOT NULL | Nama model produk |
| serial_number | text | NOT NULL | Nomor seri produk |
| tanggal_kejadian | text | NOT NULL | Tanggal kejadian (ISO Date string) |
| notification_number | text |  | Nomor notifikasi dari cabang |
| detail | text |  | Deskripsi detail masalah |
| keterangan | text |  | Catatan tambahan opsional |
| status | text | NOT NULL, DEFAULT 'Open' | Status penanganan (Open, In Progress, Closed) |

INDEX:

* INDEX (status)
* INDEX (notification_number)
* INDEX (model_name)

📌 CATATAN:

* Tabel ini adalah *parent* (induk) dari riwayat *action* (`quality_issue_details`).
* Disarankan menggunakan format ISO 8601 untuk `tanggal_kejadian`.

## 2. QualityIssueDetail (Riwayat Action)

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID riwayat action |
| issue_id | integer | FK -> quality_issues.id onDelete: 'cascade' | Relasi ke tabel QualityIssue |
| tanggal | text | NOT NULL | Tanggal update (ISO Date string) |
| action | text | NOT NULL | Tindakan / progress yang dilakukan |
| remark | text |  | Catatan tambahan untuk action ini |

INDEX:

* INDEX (issue_id)
* INDEX (tanggal)

📌 CATATAN:

* Jika data `QualityIssue` dihapus, seluruh riwayat ini akan ikut terhapus (*cascade*).

## 3. Attachment

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID lampiran file |
| detail_id | integer | FK -> quality_issue_details.id onDelete: 'cascade' | Jika diunggah di menu riwayat action |
| sample_id | integer | FK -> sample_defects.id onDelete: 'cascade' | Jika diunggah di menu hasil analisa PQA |
| report_id | integer | FK -> technical_reports.id onDelete: 'cascade' | Jika diunggah di menu Technical Report |
| file_name | text | NOT NULL | Nama file asli |
| file_url | text | NOT NULL | Path lokal file (misal: `/uploads/...`) |
| file_type | text | NOT NULL | Ekstensi/MIME type (misal: `image/jpeg`) |
| file_size | integer |  | Ukuran file dalam bytes |

INDEX:

* INDEX (detail_id)
* INDEX (sample_id)
* INDEX (report_id)

📌 CATATAN:

* Tabel polimorfik semu: Satu baris data biasanya hanya akan mengisi salah satu dari kolom FK (`detail_id`, `sample_id`, atau `report_id`) dan dua lainnya `null`.

## 4. SampleDefect

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID log sampel part |
| issue_id | integer | FK -> quality_issues.id onDelete: 'set null' | Opsional (jika dikaitkan ke klaim) |
| notification_number | text | NOT NULL | Nomor notifikasi cabang |
| model_name | text | NOT NULL | Nama model |
| serial_number | text | NOT NULL | Nomor seri produk |
| cabang | text | NOT NULL | Nama cabang |
| part_number | text | NOT NULL | Nomor part yang cacat |
| part_name | text | NOT NULL | Nama part |
| kerusakan_cabang | text | NOT NULL | Laporan kerusakan dari cabang |
| status | text | NOT NULL, DEFAULT 'Diminta' | (Diminta / Diterima / Diserahkan / dll) |
| tanggal_terima | text |  | Tanggal fisik diterima (ISO Date) |
| keterangan_terima | text |  | Catatan penerimaan |
| nama_penerima_pqa | text |  | Nama staff PQA penerima |
| tanggal_serah_pqa | text |  | Tanggal diserahkan ke PQA |
| kerusakan_verifikasi | text |  | Hasil cek PQA |
| kondisi_pqa | text |  | "NG" (No Good) / "NDF" (No Defect Found) |
| repair | text |  | Catatan perbaikan PQA |
| hasil_analisa_supplier | text |  | Ringkasan teks analisa supplier per part |

INDEX:

* INDEX (issue_id)
* INDEX (notification_number)
* INDEX (status)

## 5. TechnicalReport

| Kolom | Tipe | Constraint | Keterangan |
| --- | --- | --- | --- |
| id | integer | PK | ID Technical Report |
| issue_id | integer | FK -> quality_issues.id onDelete: 'set null' | Opsional (jika penyelesaian klaim) |
| document_number | text | NOT NULL, UNIQUE | Nomor registrasi laporan |
| document_type | text | NOT NULL | "Technical Report" atau "Service Tips" |
| release_date | text | NOT NULL | Tanggal rilis (ISO Date) |
| model_name | text | NOT NULL | Model yang dibahas |
| issue_name | text | NOT NULL | Judul masalah |
| root_cause | text |  | Analisa akar masalah |
| action | text |  | Tindakan perbaikan yang direkomendasi |
| improvement_start_date | text |  | Tanggal cut-off perbaikan |
| improvement_start_serial_number | text |  | Nomor seri cut-off perbaikan |
| document_reference | text |  | Ref. text ke dokumen lain |
| keterangan | text |  | Catatan tambahan opsional |

INDEX:

* UNIQUE (document_number)
* INDEX (issue_id)
* INDEX (document_type)

---

