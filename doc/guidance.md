# Database Lifecycle

Dokumen ini menjelaskan migration, seed, dan reset database pada TASK-012.

## Migration

Migration menerapkan perubahan schema ke database SQLite menggunakan Drizzle.

Helper [server/database/migrate.ts](../server/database/migrate.ts) menyediakan
satu fungsi `migrateDatabase` yang dapat dipakai oleh script database dan test.
Dengan begitu, migration dijalankan melalui mekanisme resmi Drizzle dan
statusnya dicatat pada tabel `__drizzle_migrations`.

Migration dapat dijalankan dengan:

```bash
pnpm db:migrate
```

Migration aman untuk dijalankan ulang. Migration yang sudah diterapkan tidak
akan dijalankan kembali.

## Development Seed

Seed membuat data contoh untuk development, bukan data produksi.

Jalankan:

```bash
pnpm db:seed
```

Alurnya:

1. Membuka database dan menjalankan migration.
2. Membuat user development melalui Better Auth agar password di-hash oleh
   provider auth.
3. Membuat contoh Quality Issue, timeline, Sample Defect, Technical Report,
   dan audit log.
4. Menjalankan insert data terkait dalam satu transaction.
5. Mengecek identifier seed agar command dapat dijalankan ulang tanpa membuat
   duplikat.

## Database Reset

Reset digunakan untuk menghapus database lokal dan membuatnya kembali dari
awal.

Jalankan:

```bash
pnpm db:reset
```

Command ini menghapus file database SQLite beserta file WAL/SHM, lalu
menjalankan migration dan development seed.

Reset berguna ketika:

- development perlu dimulai dari database kosong;
- database lokal rusak atau state-nya tidak konsisten;
- perlu mengulang integration test atau demo.

`db:reset` hanya dapat dijalankan pada environment non-production karena semua
data pada database akan dihapus.

Environment dibaca dari variable `NODE_ENV`. Untuk melihat nilainya:

```bash
echo ${NODE_ENV:-unset}
```

Reset secara eksplisit pada development:

```bash
NODE_ENV=development pnpm db:reset
```

Jika `NODE_ENV=production`, command akan ditolak. Jika variable tidak diatur,
implementasi saat ini masih mengizinkan reset, sehingga sebaiknya selalu
menentukan `NODE_ENV=development` saat menjalankan reset.
