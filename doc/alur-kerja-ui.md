# Alur Kerja UI (UI Workflow)

Dokumen ini mendefinisikan perilaku UI, urutan operasi, state, dan feedback
pengguna. UI bukan sumber kebenaran business rule; server tetap memvalidasi
auth, input, transition, transaction, dan ownership attachment.

## 1. Konvensi UI

- Semua halaman aplikasi selain `/login` membutuhkan session valid.
- List page memakai server-side pagination dengan default 20 row.
- Search, filter, page, limit, dan sort disimpan pada URL query.
- Setiap list, detail, dan form memiliki loading, error, empty, dan success
  state.
- Action invalid disembunyikan atau disabled berdasarkan state, tetapi server
  tetap melakukan validasi ulang.
- Error API ditampilkan dalam pesan yang dapat ditindaklanjuti.
- Upload menampilkan filename, ukuran, tipe, progress, success, dan failure.
- Destructive action memakai confirmation dialog.

## 2. Route Utama

| Route | Tujuan |
| --- | --- |
| `/login` | Login |
| `/` | Dashboard |
| `/quality-issues` | List Quality Issue |
| `/quality-issues/new` | Create Quality Issue |
| `/quality-issues/[id]` | Detail, timeline, attachment, transition |
| `/sample-defects` | List Sample Defect |
| `/sample-defects/new` | Create batch sample |
| `/sample-defects/[id]` | Detail part dan action state |
| `/technical-reports` | List Technical Report / Service Tips |
| `/technical-reports/new` | Create report |
| `/technical-reports/[id]` | Detail dan attachment |

## 3. Authentication dan Shell

1. Pengguna membuka halaman terproteksi.
2. Middleware memeriksa session server-side.
3. Jika session tidak ada atau expired, pengguna diarahkan ke `/login`.
4. Setelah login berhasil, pengguna diarahkan ke dashboard.
5. Logout menghapus session dan mengarahkan kembali ke `/login`.
6. Session expired saat mutation berjalan menampilkan error auth dan meminta
   login ulang tanpa menganggap mutation berhasil.

## 4. Dashboard

1. Dashboard memuat KPI, status summary, trend, dan recent records melalui
   endpoint aggregation.
2. Setiap widget memiliki loading, empty, dan error state.
3. Klik widget atau recent record membuka list/detail dengan filter relevan.
4. Browser tidak mengambil seluruh tabel untuk menghitung KPI.

## 5. Quality Issue

### 5.1 Create Quality Issue

1. Pengguna membuka `/quality-issues/new`.
2. Form memuat `issue_name`, `model_name`, `serial_number`,
   `tanggal_kejadian`, `notification_number`, `detail`, `keterangan`, dan
   attachment optional.
3. Client melakukan validasi UX; API melakukan validasi Zod ulang.
4. Service membuat row `quality_issues` dengan status `OPEN`.
5. Jika ada attachment awal, service membuat satu row
   `quality_issue_details` dengan action `INITIAL_EVIDENCE`, lalu menyimpan
   attachment dengan `detail_id` tersebut.
6. File ditulis memakai generated physical name; metadata menyimpan nama asli.
7. Jika sebagian upload gagal, file yang sudah ditulis tetapi belum tercatat
   dibersihkan dan response menjelaskan item yang gagal.
8. Setelah berhasil, UI mengarahkan ke `/quality-issues/[id]` dan menampilkan
   toast sukses.

### 5.2 Add Progress

1. Pengguna membuka detail Quality Issue dan memilih `Update Progress`.
2. Pengguna mengisi tanggal, action, remark, dan attachment optional.
3. Service memvalidasi issue masih ada dan session berwenang.
4. Service membuat detail timeline, menyimpan file, dan mengembalikan timeline
   terbaru.
5. Attachment menggunakan `detail_id`; `sample_id` dan `report_id` null.
6. Perubahan status, jika diminta oleh operation, hanya melalui state machine
   dan ditulis ke audit log.

### 5.3 Status Transition

Forward action:

```text
OPEN -> IN_PROGRESS
IN_PROGRESS -> MONITORING
MONITORING -> CLOSED
```

Rollback satu langkah hanya untuk Admin:

```text
CLOSED -> MONITORING
MONITORING -> IN_PROGRESS
IN_PROGRESS -> OPEN
```

Generic edit tidak menyediakan input status bebas. Setelah berhasil, UI
memperbarui badge, action, timeline, dan audit state.

## 6. Sample Defect

### 6.1 Create Batch

1. Pengguna membuka `/sample-defects/new`.
2. Form meminta data bersama: notification, model, serial, cabang, optional
   Quality Issue, serta daftar `parts[]`.
3. Setiap part wajib memiliki part number, part name, dan kerusakan cabang.
4. Client memvalidasi daftar part tidak kosong dan menampilkan field error.
5. API memvalidasi seluruh payload sebelum transaction dimulai.
6. Service membuat satu `batch_id`, lalu insert semua part dengan status
   `REQUESTED` dalam satu transaction.
7. Jika satu part invalid atau insert gagal, tidak ada part yang tersimpan.
8. Setelah commit, UI membuka list atau halaman batch dengan seluruh part.

### 6.2 Receive

1. Pengguna mencari batch/part berdasarkan notification, batch, model, atau
   status.
2. Pengguna memilih part yang tiba dan menekan `Tandai Diterima`.
3. Hanya part berstatus `REQUESTED` yang dapat diproses.
4. Service mengisi `status = RECEIVED`, `tanggal_terima`, dan keterangan.
5. Setiap part yang diproses menghasilkan audit event.

### 6.3 QRCC Verification

1. Action tersedia hanya pada status `RECEIVED`.
2. Pengguna mengisi hasil verifikasi dan menyimpan.
3. Service mengubah status ke `QRCC_VERIFIED` dan menyimpan hasil verifikasi.

### 6.4 Handover ke PQA

1. Action tersedia hanya pada status `QRCC_VERIFIED`.
2. Pengguna mengisi nama PIC PQA.
3. Service mengisi `nama_penerima_pqa`, `tanggal_serah_pqa`, dan status
   `HANDED_OVER_TO_PQA`.

### 6.5 PQA Analysis

1. Action tersedia hanya pada status `HANDED_OVER_TO_PQA`.
2. Pengguna mengisi `kondisi_pqa` (`NG` atau `NDF`), hasil verifikasi,
   `repair`, dan attachment foto optional.
3. Attachment dimiliki oleh `sample_id`.
4. Service menyimpan data dan mengubah status ke `PQA_ANALYZED`.

### 6.6 Supplier Analysis

1. Action tersedia hanya pada status `PQA_ANALYZED`.
2. Pengguna mengisi `hasil_analisa_supplier` per part.
3. Jika laporan supplier berupa PDF, PDF dicatat sebagai progress pada Quality
   Issue terkait. Jika tidak ada Quality Issue terkait, PDF dapat disimpan
   sebagai attachment Technical Report.
4. Service mengubah status ke `SUPPLIER_ANALYZED` setelah data wajib tersedia.

### 6.7 Rollback

1. Hanya Admin melihat action rollback yang valid.
2. UI hanya menawarkan target satu langkah ke belakang.
3. Server memvalidasi role, current state, target state, dan menulis audit log.
4. Setelah berhasil, UI memuat ulang detail dan timeline.

## 7. Technical Report / Service Tips

1. Pengguna membuka `/technical-reports/new`.
2. Form memuat nomor dokumen, tipe, tanggal rilis, model, issue name,
   root cause, action, improvement cutoff, reference, keterangan, optional
   Quality Issue, dan attachment.
3. Tipe hanya `TECHNICAL_REPORT` atau `SERVICE_TIPS`.
4. API menolak nomor dokumen duplikat dengan field error yang jelas.
5. Service membuat report, menyimpan attachment PDF/XLSX, dan mengembalikan
   detail.
6. Attachment menggunakan `report_id`; owner lain harus null.
7. Detail menyediakan search, download/open attachment, dan relasi Quality
   Issue bila tersedia.

## 8. Delete dan Cleanup

1. Delete hanya tersedia untuk Admin dan selalu meminta konfirmasi.
2. Server menulis audit delete sebelum mutation.
3. Service menghapus domain row dan metadata attachment dalam transaction.
4. Physical file dihapus setelah metadata berhasil dihapus. Jika physical
   cleanup gagal, error dicatat untuk retry/reconciliation.
5. Cascade database tidak boleh dianggap otomatis menghapus file fisik.

## 9. Shared UI Components

Komponen reusable minimum:

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

State management MVP menggunakan composables per domain:
`useAuth`, `useQualityIssues`, `useSampleDefects`,
`useTechnicalReports`, `useDashboard`, dan `usePagination`.
