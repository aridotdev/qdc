import { sql, type SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'

/**
 * Membangun ekspresi `CHECK (column IN ('A','B',...))` dari sebuah kolom dan
 * daftar nilai yang sudah diketahui aman (berasal dari const object di
 * `constants.ts`, bukan input user), sehingga aman digunakan lewat
 * `sql.raw` tanpa risiko SQL injection.
 */
export function checkEnum(column: SQLiteColumn, values: readonly string[]): SQL {
  const list = values.map(value => `'${value}'`).join(', ')
  return sql`${column} in (${sql.raw(list)})`
}
