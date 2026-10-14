import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createDatabase } from '../../server/database/client'
import { migrateDatabase } from '../../server/database/migrate'
import { backfillPublicIds } from '../../server/database/public-id-backfill'
import {
  qualityIssues,
  sampleDefects,
  technicalReports
} from '../../server/database/schema'
import {
  qualityIssuePublicIdSchema,
  sampleDefectPublicIdSchema,
  technicalReportPublicIdSchema
} from '../../shared/validators/public-id'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const previousMigrations = [
  '20260929223905_cute_tempest',
  '20260929224520_early_stingray',
  '20260930100000_audit_logs_append_only'
]

describe('public ID backfill', () => {
  const temporaryDirectories: string[] = []

  afterAll(async () => {
    await Promise.all(
      temporaryDirectories.map(directory => rm(directory, { recursive: true, force: true }))
    )
  })

  it('backfills existing rows, enforces NOT NULL, and is idempotent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qdc-public-id-backfill-'))
    temporaryDirectories.push(directory)
    const legacyMigrationsFolder = join(directory, 'legacy-migrations')

    for (const migration of previousMigrations) {
      await cp(
        join(migrationsFolder, migration),
        join(legacyMigrationsFolder, migration),
        { recursive: true }
      )
    }

    const database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)

    try {
      await migrate(database.db, { migrationsFolder: legacyMigrationsFolder })

      const now = '2026-10-13T00:00:00.000Z'
      await database.client.execute({
        sql: `
          INSERT INTO quality_issues
            (issue_name, model_name, serial_number, tanggal_kejadian, detail,
             created_at, updated_at, created_by_user_id, updated_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: ['Legacy issue', 'MODEL-LEGACY', 'SN-LEGACY', '2026-10-13', 'Legacy', now, now, 'user-1', 'user-1']
      })
      await database.client.execute({
        sql: `
          INSERT INTO sample_defects
            (batch_id, issue_id, notification_number, model_name, serial_number,
             cabang, part_number, part_name, kerusakan_cabang, created_at,
             updated_at, created_by_user_id, updated_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: ['BATCH-LEGACY', 1, 'N-LEGACY', 'MODEL-LEGACY', 'SN-LEGACY', 'Jakarta', 'PART-LEGACY', 'Legacy part', 'Legacy', now, now, 'user-1', 'user-1']
      })
      await database.client.execute({
        sql: `
          INSERT INTO technical_reports
            (document_number, issue_id, document_type, release_date, model_name,
             issue_name, created_at, updated_at, created_by_user_id, updated_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: ['REPORT-LEGACY', 1, 'TECHNICAL_REPORT', '2026-10-13', 'MODEL-LEGACY', 'Legacy report', now, now, 'user-1', 'user-1']
      })

      await migrateDatabase(database, migrationsFolder)
      const firstResult = await backfillPublicIds(database)
      const firstIds = {
        issue: await database.db.select({ publicId: qualityIssues.publicId }).from(qualityIssues),
        sample: await database.db.select({ publicId: sampleDefects.publicId }).from(sampleDefects),
        report: await database.db.select({ publicId: technicalReports.publicId }).from(technicalReports)
      }

      const secondResult = await backfillPublicIds(database)
      const secondIds = {
        issue: await database.db.select({ publicId: qualityIssues.publicId }).from(qualityIssues),
        sample: await database.db.select({ publicId: sampleDefects.publicId }).from(sampleDefects),
        report: await database.db.select({ publicId: technicalReports.publicId }).from(technicalReports)
      }

      expect(firstResult).toEqual({ qualityIssues: 1, sampleDefects: 1, technicalReports: 1 })
      expect(secondResult).toEqual({ qualityIssues: 0, sampleDefects: 0, technicalReports: 0 })
      expect(secondIds).toEqual(firstIds)
      expect(qualityIssuePublicIdSchema.safeParse(firstIds.issue[0]?.publicId).success).toBe(true)
      expect(sampleDefectPublicIdSchema.safeParse(firstIds.sample[0]?.publicId).success).toBe(true)
      expect(technicalReportPublicIdSchema.safeParse(firstIds.report[0]?.publicId).success).toBe(true)

      for (const tableName of ['quality_issues', 'sample_defects', 'technical_reports']) {
        const result = await database.client.execute({
          sql: 'SELECT name, "notnull" FROM pragma_table_info(?) WHERE name = ?',
          args: [tableName, 'public_id']
        })
        expect(result.rows).toEqual([{ name: 'public_id', notnull: 1 }])
      }

      await database.client.execute('DELETE FROM quality_issues WHERE id = 1')
      const relatedRows = await database.client.execute(`
        SELECT issue_id FROM sample_defects WHERE id = 1
        UNION ALL
        SELECT issue_id FROM technical_reports WHERE id = 1
      `)
      expect(relatedRows.rows).toEqual([{ issue_id: null }, { issue_id: null }])
    } finally {
      database.client.close()
    }
  })
})
