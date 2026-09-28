import { migrate } from 'drizzle-orm/libsql/migrator'
import { join } from 'node:path'
import type { createDatabase } from './client'

export const migrationsFolder = join(process.cwd(), 'server/database/migrations')

type Database = Awaited<ReturnType<typeof createDatabase>>

export async function migrateDatabase(
  database: Database,
  folder: string = migrationsFolder
): Promise<void> {
  await migrate(database.db, { migrationsFolder: folder })
}
