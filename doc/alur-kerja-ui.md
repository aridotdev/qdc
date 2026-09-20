# Alur Kerja UI (UI Workflow)

Bagian ini menjelaskan *step-by-step* bagaimana antarmuka pengguna (UI) berinteraksi dengan tabel-tabel di atas sesuai operasi keseharian *Quality Control*.

### 1. Alur Modul "Quality Issue"

* **Aksi: Buat Klaim Baru**
* **UI:** User membuka form *"Add New Quality Issue"*. Mengisi data master seperti `issueName`, `modelName`, `serialNumber`, `tanggalKejadian`, dsb.
* **Database:** Melakukan `INSERT` 1 baris ke tabel **`quality_issues`**.


* **Aksi: Update Progress & Tambah Lampiran**
* **UI:** User membuka halaman detail sebuah klaim. Memilih tab *"Update Progress"*. User mengetik keterangan *action*, tanggal, lalu mengunggah 3 foto mesin yang rusak sekaligus.
* **Database:**
1. Melakukan `INSERT` ke **`quality_issue_details`** dengan `issue_id` dari klaim tersebut. (Sistem akan mengembalikan ID `detail_id` baru).
2. Menyimpan fisik ke-3 foto ke folder `/uploads`.
3. Melakukan 3x `INSERT` ke tabel **`attachments`** menggunakan `detail_id` yang didapat dari langkah 1 (kolom `sample_id` dan `report_id` dibiarkan `null`).



### 2. Alur Modul "Sample Defect" (State Machine)

* **Aksi 1: Meminta Sampel dari Cabang**
* **UI:** User menerima email/notifikasi bahwa ada 3 part rusak untuk klaim nomor seri X. User membuka form *"Request New Sample"*. Mengisi data `notificationNumber`, `modelName`, `cabang`, lalu menambahkan 3 baris *Part Number* & *Part Name* yang berbeda di dalam satu layar.
* **Database:** Melakukan 3x `INSERT` ke tabel **`sample_defects`** secara bersamaan. Kolom status akan otomatis terisi `'Diminta'`.


* **Aksi 2: Menerima Barang Fisik**
* **UI:** Paket dari CS tiba di meja QC. User mencari data di tabel menggunakan `notificationNumber`, menyeleksi part yang datang, dan menekan tombol **"Tandai Diterima"**.
* **Database:** Melakukan `UPDATE` pada data **`sample_defects`** terpilih: mengubah `status = 'Diterima'` dan mencatat `tanggal_terima`.


* **Aksi 3: Penyerahan ke Laboratorium PQA**
* **UI:** User memberikan kotak part ke analis PQA. Di sistem, user menekan tombol **"Serahkan ke PQA"** dan mengetik nama PIC (misal: "Budi").
* **Database:** Melakukan `UPDATE` data: mengubah `status = 'Diserahkan ke PQA'` dan mencatat `nama_penerima_pqa` serta waktu penyerahan.


* **Aksi 4: PQA Melaporkan Analisa Internal**
* **UI:** PQA menginfokan hasilnya. User membuka baris part tersebut, mengisi kolom **"Kondisi (NG/NDF)"**, mencatat hasil analisa, dan **mengunggah 1 foto makro part yang rusak**.
* **Database:** `UPDATE` kolom `kondisi_pqa`, `kerusakan_verifikasi`, dan `repair`. Foto akan memicu `INSERT` ke tabel **`attachments`** (menggunakan kolom `sample_id`).


* **Aksi 5: Menerima Laporan Lengkap dari Supplier (PDF)**
* **UI:** Supplier mengirim 1 PDF *Root Cause Analysis* utuh. User melakukan 2 hal:
1. Buka Modul *Quality Issue* -> *Update Progress*, lalu ketik "Terima laporan dari supplier" dan unggah file PDF tersebut.
2. Buka Modul *Sample Defect*, ketik kesimpulan teks pendek di kolom `hasil_analisa_supplier` untuk setiap part.





### 3. Alur Modul "Technical Report (TR)"

* **Aksi: Mengarsipkan Dokumen TR/Service Tips Baru**
* **UI:** Pihak HQ merilis *Service Tips* baru. User membuka form *"Add Technical Report"*. Mengisi nomor dokumen, jenis dokumen, rincian *root cause* dan tanggal *cut-off serial number*. User mengunggah 1 file dokumen PDF utama, dan 1 file Excel pendukung. User secara opsional menghubungkan TR ini dengan masalah nomor #150 di sistem.
* **Database:**
1. Melakukan `INSERT` ke tabel **`technical_reports`** (mengisi `issue_id` jika direlasikan).
2. Menyimpan 2 file fisik ke `/uploads`.
3. Melakukan 2x `INSERT` ke tabel **`attachments`** menggunakan `report_id` yang baru saja dibuat (kolom `detail_id` dan `sample_id` dibiarkan `null`).