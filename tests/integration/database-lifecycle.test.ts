import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDatabase } from '../../server/database/client'
import { migrateDatabase } from '../../server/database/migrate'
import { developmentSeed, seedDatabase } from '../../server/database/seed'
import {
  auditLogs,
  qualityIssues,
  sampleDefects,
  technicalReports,
  user
} from '../../server/database/schema'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')

describe('database lifecycle', () => {
  const temporaryDirectories: string[] = []

  afterAll(async () => {
    await Promise.all(
      temporaryDirectories.map(directory => rm(directory, { recursive: true, force: true }))
    )
  })

  it('runs a clean migration and safely re-runs it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qdc-migration-'))
    temporaryDirectories.push(directory)
    const database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)

    try {
      await migrateDatabase(database, migrationsFolder)
      const firstMigrations = await database.client.execute(
        'SELECT id, hash, name FROM __drizzle_migrations'
      )

      await migrateDatabase(database, migrationsFolder)
      const secondMigrations = await database.client.execute(
        'SELECT id, hash, name FROM __drizzle_migrations'
      )
      const tables = await database.client.execute({
        sql: 'SELECT name FROM sqlite_master WHERE type = ? AND name IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ORDER BY name',
        args: [
          'table',
          'account',
          'attachments',
          'audit_logs',
          'quality_issue_details',
          'quality_issues',
          'sample_defects',
          'session',
          'technical_reports',
          'user',
          'verification'
        ]
      })

      expect(firstMigrations.rows).toHaveLength(1)
      expect(secondMigrations.rows).toEqual(firstMigrations.rows)
      expect(tables.rows).toEqual([
        { name: 'account' },
        { name: 'attachments' },
        { name: 'audit_logs' },
        { name: 'quality_issue_details' },
        { name: 'quality_issues' },
        { name: 'sample_defects' },
        { name: 'session' },
        { name: 'technical_reports' },
        { name: 'user' },
        { name: 'verification' }
      ])
    } finally {
      database.client.close()
    }
  })

  it('seeds development data idempotently', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qdc-seed-'))
    temporaryDirectories.push(directory)
    const database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)

    try {
      await migrateDatabase(database, migrationsFolder)
      const firstSeed = await seedDatabase(database.db)
      const secondSeed = await seedDatabase(database.db)
      const seededUsers = await database.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, developmentSeed.userEmail))
      const seededIssues = await database.db
        .select({ id: qualityIssues.id })
        .from(qualityIssues)
        .where(eq(qualityIssues.serialNumber, developmentSeed.serialNumber))
      const seededSamples = await database.db
        .select({ id: sampleDefects.id })
        .from(sampleDefects)
        .where(eq(sampleDefects.serialNumber, developmentSeed.serialNumber))
      const seededReports = await database.db
        .select({ id: technicalReports.id })
        .from(technicalReports)
        .where(eq(technicalReports.documentNumber, developmentSeed.documentNumber))
      const seededAuditLogs = await database.db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(eq(auditLogs.actorUserId, firstSeed.userId))

      expect(firstSeed.seeded).toBe(true)
      expect(secondSeed).toEqual({ userId: firstSeed.userId, seeded: false })
      expect(seededUsers).toHaveLength(1)
      expect(seededIssues).toHaveLength(1)
      expect(seededSamples).toHaveLength(1)
      expect(seededReports).toHaveLength(1)
      expect(seededAuditLogs).toHaveLength(4)
    } finally {
      database.client.close()
    }
  })

  it('does not record a failed migration as applied', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qdc-failed-migration-'))
    temporaryDirectories.push(directory)
    const brokenMigrationsFolder = join(directory, 'migrations')
    const migrationFolder = join(brokenMigrationsFolder, '20260927150000_broken')
    await mkdir(migrationFolder, { recursive: true })
    await writeFile(
      join(migrationFolder, 'migration.sql'),
      'CREATE TABLE partial_migration (id integer);\n--> statement-breakpoint\nTHIS IS NOT VALID SQL;'
    )

    const database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)

    try {
      await expect(migrateDatabase(database, brokenMigrationsFolder)).rejects.toThrow()

      const migrations = await database.client.execute('SELECT id FROM __drizzle_migrations')
      const partialTable = await database.client.execute({
        sql: 'SELECT name FROM sqlite_master WHERE type = ? AND name = ?',
        args: ['table', 'partial_migration']
      })

      expect(migrations.rows).toEqual([])
      expect(partialTable.rows).toEqual([])
    } finally {
      database.client.close()
    }
  })
})
