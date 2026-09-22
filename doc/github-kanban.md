# GitHub Kanban Backlog

Backlog di `doc/implementation.md` dapat dipublish menjadi GitHub Issues dan
GitHub Project board dengan script:

```sh
node scripts/create-github-kanban.mjs --dry-run
node scripts/create-github-kanban.mjs
```

Default target:

- Repository issue: `aridotdev/qdc`
- Project owner: `aridotdev`
- Project title: `QRCC Data Center Implementation`

Sebelum publish, pastikan GitHub CLI sudah login dan memiliki scope project:

```sh
gh auth login -h github.com
gh auth refresh -h github.com -s project
```

Script akan:

- Membaca semua `TASK-###` dari `doc/implementation.md`.
- Membuat label `backlog`, `type: task`, `priority: P0/P1/P2`, dan `area: ...`.
- Membuat issue dengan acceptance criteria dan test scope dari dokumen.
- Membuat atau memakai GitHub Project dengan judul default.
- Menambahkan issue ke project dan mengisi field `Kanban Status`,
  `Priority`, `Task ID`, dan `Dependencies`.

Di GitHub Project, ubah layout ke `Board` dan group by `Kanban Status` agar
tampil sebagai kanban. Semua issue baru akan dimasukkan ke kolom `Backlog`.

Opsi umum:

```sh
node scripts/create-github-kanban.mjs \
  --repo aridotdev/qdc \
  --owner aridotdev \
  --project-title "QRCC Data Center Implementation"
```

Gunakan `--skip-project` jika hanya ingin membuat GitHub Issues tanpa
menambahkannya ke project.
