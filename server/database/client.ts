import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { relations } from './schema'

export async function createDatabase(url: string) {
  const client = createClient({
    url,
    // SQLite PRAGMA foreign_keys is connection-scoped.
    concurrency: 1
  })

  await client.execute('PRAGMA foreign_keys = ON')
  const journalMode = await client.execute('PRAGMA journal_mode = WAL')
  const activeJournalMode = String(journalMode.rows[0]?.journal_mode ?? '').toLowerCase()

  if (activeJournalMode !== 'wal') {
    client.close()
    throw new Error(`SQLite WAL mode could not be enabled. Active mode: ${activeJournalMode || 'unknown'}`)
  }

  return {
    client,
    db: drizzle({ client, relations })
  }
}
