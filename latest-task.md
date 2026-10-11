TASK-028 itu membuat UI untuk **Create Quality Issue**.

Intinya: tambah halaman `/quality-issues/new` berisi form `issue_name`, `model_name`, `serial_number`, `tanggal_kejadian`, `notification_number`, `detail`, `keterangan`, plus uploader attachment opsional. Saat submit, UI kirim ke `POST /api/quality-issues`, API tetap melakukan validasi final, lalu kalau sukses user diarahkan ke `/quality-issues/[id]`.

Rencana minimal tapi solid:

1. Tambah tombol `New Quality Issue` di list `/quality-issues`.
2. Buat halaman `app/pages/quality-issues/new.vue`.
3. Pakai `UForm` + schema client ringan yang selaras dengan `createQualityIssueSchema`.
4. Submit pakai `FormData` supaya field dan file masuk ke API multipart yang sudah ada.
5. Saat pending: disable submit dan cegah double submit.
6. Tampilkan error field dari client/API, plus error umum kalau submit gagal.
7. Setelah sukses: toast sukses, lalu redirect ke detail issue dari `issueId`.
8. Test fokus ke flow acceptance: valid create, field error, file error, retry, redirect.
