# TASK-029: Quality Issue Detail, Timeline, dan Actions UI

## Tujuan

Membangun halaman detail Quality Issue yang lengkap dan terhubung dengan API
yang sudah tersedia.

Status implementasi: halaman detail, timeline, progress, attachment display,
dan status action sudah dibuat. Verifikasi browser E2E dan manual masih terbuka.

Alur utama yang harus selesai:

`list/create -> detail -> lihat timeline -> tambah progress -> upload attachment -> ubah status`

## 1. Audit dan persiapan

- [x] Baca kontrak response `GET /api/quality-issues/:id`.
- [x] Baca kontrak response `GET /api/quality-issues/:id/details`.
- [x] Baca payload dan response `POST /api/quality-issues/:id/details`.
- [x] Baca payload dan response `POST /api/quality-issues/:id/status`.
- [x] Baca kontrak upload `POST /api/quality-issues/:id/attachments`.
- [x] Baca kontrak download/delete attachment.
- [x] Catat status Quality Issue dan transition yang valid dari state machine.
- [x] Catat role yang boleh melakukan forward dan rollback.
- [x] Pastikan route detail menerima `publicId` dan ID numeric lama.
- [x] Tentukan komponen UI yang dapat digunakan ulang dari halaman create/list.

## 2. Route dan halaman detail

- [x] Buat route `app/pages/quality-issues/[id].vue`.
- [x] Ambil parameter route dari `id`.
- [x] Fetch data detail berdasarkan `publicId` atau ID numeric.
- [x] Fetch data timeline/detail berdasarkan identifier yang sama.
- [x] Tampilkan tombol kembali ke daftar Quality Issue.
- [x] Pastikan halaman dapat dibuka dari row pada halaman list.
- [x] Pastikan halaman dapat dibuka setelah redirect dari halaman create.

## 3. Tampilan master data

- [x] Tampilkan `businessId` sebagai ID operasional.
- [x] Tampilkan `publicId` bila diperlukan untuk konteks teknis atau URL.
- [x] Tampilkan nama issue.
- [x] Tampilkan model name.
- [x] Tampilkan serial number.
- [x] Tampilkan tanggal kejadian.
- [x] Tampilkan nomor notifikasi jika tersedia.
- [x] Tampilkan detail issue.
- [x] Tampilkan keterangan jika tersedia.
- [x] Tampilkan status dengan badge yang konsisten dengan halaman list.
- [x] Tampilkan metadata waktu dibuat dan terakhir diperbarui bila tersedia.

## 4. Loading, empty, error, dan not found

- [x] Tambahkan loading state saat master data sedang dimuat.
- [x] Tambahkan loading state saat timeline sedang dimuat.
- [x] Tambahkan error state untuk kegagalan fetch master data.
- [x] Tambahkan error state untuk kegagalan fetch timeline.
- [x] Tampilkan pesan not found jika Quality Issue tidak ditemukan.
- [x] Sediakan tombol retry untuk request yang gagal.
- [x] Tampilkan empty state jika belum ada progress selain detail awal.
- [x] Pastikan error mutation tidak menghilangkan data yang sudah tampil.
- [x] Pastikan tidak ada runtime error saat field opsional bernilai null.

## 5. Timeline dan progress

- [x] Tampilkan detail awal sebagai item pertama timeline.
- [x] Tampilkan setiap progress secara berurutan berdasarkan tanggal.
- [x] Tampilkan action setiap item timeline.
- [x] Tampilkan tanggal dan waktu setiap item timeline.
- [x] Tampilkan remark jika tersedia.
- [x] Tampilkan attachment pada item timeline yang memilikinya.
- [x] Bedakan secara visual detail awal dan progress lanjutan.
- [x] Buat form tambah progress.
- [ ] Tambahkan field tanggal progress bila diperlukan.
- [x] Tambahkan field action.
- [x] Tambahkan field remark.
- [x] Tambahkan upload attachment pada form progress bila didukung API.
- [x] Validasi input melalui API dan tampilkan field error dengan jelas.
- [x] Disable submit selama request berjalan.
- [x] Reset atau refresh form setelah progress berhasil dibuat.
- [x] Refresh timeline setelah progress berhasil dibuat.

## 6. Attachment

- [x] Tampilkan daftar attachment pada detail awal.
- [x] Tampilkan daftar attachment pada setiap progress terkait.
- [x] Tampilkan nama file dan tipe file.
- [x] Sediakan aksi membuka atau mengunduh attachment.
- [ ] Tampilkan loading state saat attachment dibuka.
- [ ] Tampilkan error jika attachment gagal dibuka atau diunduh.
- [x] Tampilkan upload attachment jika alur UI membutuhkannya.
- [x] Validasi tipe dan ukuran file sebelum submit.
- [ ] Tampilkan progress atau status upload.
- [x] Refresh data setelah upload berhasil.
- [x] Tampilkan feedback yang jelas jika upload gagal.

## 7. Action status dan authorization UI

- [x] Tampilkan action forward hanya jika transition valid untuk status saat ini.
- [x] Tampilkan action rollback hanya jika transition valid untuk status saat ini.
- [x] Sembunyikan rollback untuk user non-admin.
- [x] Jangan mengandalkan UI sebagai satu-satunya authorization.
- [x] Tampilkan label action yang menjelaskan status tujuan.
- [x] Disable action selama mutation berjalan.
- [x] Cegah duplicate submit atau double click.
- [x] Pastikan action tidak ditampilkan untuk status terminal jika tidak ada
      transition valid.
- [x] Pastikan status terbaru tampil setelah mutation berhasil.

## 8. Confirmation dan toast

- [x] Tampilkan confirmation sebelum forward.
- [x] Tampilkan confirmation sebelum rollback.
- [x] Minta alasan rollback jika diwajibkan oleh API.
- [x] Tampilkan toast saat status berhasil diubah.
- [x] Tampilkan toast saat progress berhasil dibuat.
- [x] Tampilkan toast saat attachment berhasil diunggah.
- [x] Tampilkan toast atau alert saat mutation gagal.
- [x] Tampilkan pesan error dari response API jika tersedia.
- [x] Setelah gagal, pertahankan data dan state halaman yang sedang dilihat.

## 9. Responsive dan aksesibilitas

- [ ] Pastikan detail usable pada desktop.
- [ ] Pastikan detail usable pada viewport tablet minimal 768 px.
- [ ] Pastikan timeline tidak meluber secara horizontal tanpa alasan.
- [ ] Pastikan label form terhubung dengan input.
- [ ] Pastikan tombol action dapat digunakan dengan keyboard.
- [ ] Pastikan dialog confirmation memiliki focus management yang benar.
- [ ] Pastikan status dan error tidak hanya dibedakan melalui warna.
- [ ] Pastikan tidak ada teks atau tombol yang saling bertumpuk.

## 10. Test unit dan integration

- [ ] Tambahkan test untuk mapping status ke action UI jika dibuat sebagai
      helper.
- [ ] Tambahkan test untuk parsing atau pemetaan timeline jika dibuat sebagai
      helper.
- [ ] Pastikan test API detail tetap lulus untuk `publicId`.
- [ ] Pastikan test API detail tetap lulus untuk ID numeric lama.
- [ ] Pastikan test invalid identifier menghasilkan error yang sesuai.
- [ ] Pastikan test not found menghasilkan state yang sesuai.
- [ ] Pastikan test progress mencakup validasi dan attachment.
- [ ] Pastikan test status mencakup forward, rollback, role, dan invalid
      transition.

## 11. E2E critical flow

- [ ] Login sebagai user yang berwenang.
- [ ] Buat Quality Issue baru.
- [ ] Pastikan redirect menuju URL dengan `publicId`.
- [ ] Pastikan detail master data tampil.
- [ ] Pastikan detail awal dan attachment tampil.
- [ ] Tambahkan progress baru.
- [ ] Pastikan progress muncul di timeline.
- [ ] Upload attachment pada progress.
- [ ] Pastikan attachment dapat dibuka atau diunduh.
- [ ] Jalankan forward transition.
- [ ] Pastikan status dan timeline terbarui.
- [ ] Login sebagai Admin dan uji rollback.
- [ ] Login sebagai non-admin dan pastikan rollback tidak tersedia.
- [ ] Uji error API dan tombol retry.
- [ ] Uji identifier invalid dan record tidak ditemukan.

## 12. Verifikasi akhir

- [x] Jalankan `pnpm typecheck`.
- [x] Jalankan `pnpm lint`.
- [x] Jalankan `pnpm test:unit`.
- [x] Jalankan `pnpm test:integration`.
- [ ] Jalankan test E2E khusus Quality Issue.
- [ ] Periksa tidak ada error di browser console pada alur utama.
- [ ] Periksa tidak ada request mutation ganda.
- [ ] Periksa attachment gagal tidak meninggalkan state UI yang rusak.
- [ ] Perbarui status TASK-029 di `doc/implementation.md`.

## Definition of Done

- [ ] Halaman detail dapat dibuka dari list dan redirect create.
- [ ] Master data, status, timeline, dan attachment tampil dengan benar.
- [ ] Loading, empty, not found, dan error state tersedia.
- [ ] Progress dapat ditambahkan dari halaman detail.
- [ ] Attachment dapat ditampilkan dan digunakan sesuai kontrak API.
- [ ] Forward dan rollback mengikuti state serta role pengguna.
- [ ] Confirmation dan toast tersedia untuk setiap mutation.
- [ ] Alur E2E create -> detail -> progress -> attachment -> status transition
      berhasil.
- [ ] Typecheck, lint, unit test, integration test, dan E2E terkait lulus.

## Addendum — Struktur storage attachment

- [x] Root storage tetap `public/uploads`.
- [x] File baru dikelompokkan dengan pola
      `public/uploads/<section>/<tahun_laporan>/<businessId>/<UUID>`.
- [x] Section yang didukung: `quality-issue`, `sample-defect`, dan
      `technical-report`.
- [x] Tahun memakai tahun laporan dibuat dan `businessId` memakai nilai lengkap.
- [x] File lama dengan pola `YYYY/MM/DD/<UUID>` tidak dipindahkan.
- [x] File dibuka melalui `GET /api/attachments/:id` setelah autentikasi;
      URL static `/uploads/...` bukan jalur akses aplikasi.
- [x] Upload, download, delete, compensation, dan cleanup tetap memakai
      `storage_name` sebagai path relatif terhadap root storage.
