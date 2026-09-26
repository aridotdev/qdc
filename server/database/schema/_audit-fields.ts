import { text } from 'drizzle-orm/sqlite-core'

/**
 * Kolom audit wajib pada setiap tabel domain, sesuai db-schema.md §1:
 * created_at, updated_at, created_by_user_id, updated_by_user_id.
 *
 * created_by_user_id / updated_by_user_id merujuk ke user ID Better-auth
 * (bukan FK ke tabel domain), sehingga cukup bertipe text NOT NULL tanpa
 * `.references()`.
 *
 * Timestamp disimpan sebagai ISO 8601 UTC string (mode 'string' bawaan
 * kolom text), bukan integer/unix-epoch, agar konsisten dengan kontrak
 * di db-schema.md.
 */
export const auditFields = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  createdByUserId: text('created_by_user_id').notNull(),
  updatedByUserId: text('updated_by_user_id').notNull()
}
