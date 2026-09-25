import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase } from '../../server/database/client'

describe('SQLite database setup', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let directory: string

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-database-'))
    database = await createDatabase(`file:${join(directory, 'test.sqlite')}`)
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('opens a local SQLite connection with foreign keys and WAL enabled', async () => {
    const connection = await database.client.execute('SELECT 1 AS connected')
    const foreignKeys = await database.client.execute('PRAGMA foreign_keys')
    const journalMode = await database.client.execute('PRAGMA journal_mode')

    expect(connection.rows).toEqual([{ connected: 1 }])
    expect(foreignKeys.rows).toEqual([{ foreign_keys: 1 }])
    expect(journalMode.rows).toEqual([{ journal_mode: 'wal' }])
  })

  it('rejects an insert that violates a foreign key', async () => {
    await database.client.execute('CREATE TABLE parent (id INTEGER PRIMARY KEY)')
    await database.client.execute(
      'CREATE TABLE child (parent_id INTEGER NOT NULL REFERENCES parent(id))'
    )

    await expect(database.client.execute('INSERT INTO child (parent_id) VALUES (999)')).rejects.toThrow()
  })
})
