import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createDatabase } from '../../server/database/client'
import {
  insertQualityIssueSchema,
  insertSampleDefectSchema,
  insertTechnicalReportSchema,
  qualityIssues,
  sampleDefects,
  technicalReports,
  updateQualityIssueSchema,
  updateSampleDefectSchema,
  updateTechnicalReportSchema
} from '../../server/database/schema'
import {
  qualityIssuePublicIdSchema,
  sampleDefectPublicIdSchema,
  technicalReportPublicIdSchema
} from '../../shared/validators/public-id'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const now = '2026-10-13T00:00:00.000Z'

describe('public ID database schema', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let directory: string

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-public-id-schema-'))
    database = await createDatabase(`file:${join(directory, 'test.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('stores public IDs as required text columns without SQL defaults', async () => {
    for (const tableName of ['quality_issues', 'sample_defects', 'technical_reports']) {
      const result = await database.client.execute({
        sql: 'SELECT * FROM pragma_table_info(?)',
        args: [tableName]
      })
      const column = result.rows.find(row => row.name === 'public_id')

      expect(column).toMatchObject({
        name: 'public_id',
        type: 'TEXT',
        notnull: 1,
        dflt_value: null
      })
    }
  })

  it('creates the three named unique indexes', async () => {
    const indexes = await database.client.execute({
      sql: `
        SELECT name, "unique"
        FROM pragma_index_list('quality_issues')
        UNION ALL
        SELECT name, "unique"
        FROM pragma_index_list('sample_defects')
        UNION ALL
        SELECT name, "unique"
        FROM pragma_index_list('technical_reports')
      `
    })

    expect(indexes.rows).toEqual(
      expect.arrayContaining([
        { name: 'quality_issues_public_id_unique', unique: 1 },
        { name: 'sample_defects_public_id_unique', unique: 1 },
        { name: 'technical_reports_public_id_unique', unique: 1 }
      ])
    )
  })

  it('generates entity-specific IDs for direct server inserts', async () => {
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Public ID issue',
        modelName: 'MODEL-PUBLIC-ID',
        serialNumber: 'SN-PUBLIC-ID',
        tanggalKejadian: '2026-10-13',
        detail: 'Schema test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ publicId: qualityIssues.publicId })

    const [sample] = await database.db
      .insert(sampleDefects)
      .values({
        batchId: 'PUBLIC-ID-BATCH',
        notificationNumber: 'PUBLIC-ID-NOTIFICATION',
        modelName: 'MODEL-PUBLIC-ID',
        serialNumber: 'SN-PUBLIC-ID',
        cabang: 'Jakarta',
        partNumber: 'PART-PUBLIC-ID',
        partName: 'Public ID part',
        kerusakanCabang: 'Schema test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ publicId: sampleDefects.publicId })

    const [report] = await database.db
      .insert(technicalReports)
      .values({
        documentNumber: 'PUBLIC-ID-REPORT',
        documentType: 'TECHNICAL_REPORT',
        releaseDate: '2026-10-13',
        modelName: 'MODEL-PUBLIC-ID',
        issueName: 'Public ID report',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ publicId: technicalReports.publicId })

    expect(qualityIssuePublicIdSchema.safeParse(issue?.publicId).success).toBe(true)
    expect(sampleDefectPublicIdSchema.safeParse(sample?.publicId).success).toBe(true)
    expect(technicalReportPublicIdSchema.safeParse(report?.publicId).success).toBe(true)
  })

  it('rejects duplicate public IDs within one table', async () => {
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Duplicate public ID issue',
        modelName: 'MODEL-DUPLICATE',
        serialNumber: 'SN-DUPLICATE',
        tanggalKejadian: '2026-10-13',
        detail: 'Schema test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ publicId: qualityIssues.publicId })

    await expect(
      database.db.insert(qualityIssues).values({
        issueName: 'Duplicate public ID issue 2',
        modelName: 'MODEL-DUPLICATE',
        serialNumber: 'SN-DUPLICATE-2',
        tanggalKejadian: '2026-10-13',
        detail: 'Schema test',
        publicId: issue!.publicId,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
    ).rejects.toThrow()
  })

  it('keeps publicId out of insert and update schemas', () => {
    const qualityIssueInput = insertQualityIssueSchema.safeParse({
      issueName: 'Issue',
      modelName: 'Model',
      serialNumber: 'Serial',
      tanggalKejadian: '2026-10-13',
      detail: 'Detail',
      publicId: 'QI-invalid'
    })
    const sampleDefectInput = insertSampleDefectSchema.safeParse({
      batchId: 'Batch',
      notificationNumber: 'Notification',
      modelName: 'Model',
      serialNumber: 'Serial',
      cabang: 'Jakarta',
      partNumber: 'Part',
      partName: 'Part name',
      kerusakanCabang: 'Defect',
      publicId: 'SD-invalid'
    })
    const technicalReportInput = insertTechnicalReportSchema.safeParse({
      documentNumber: 'Document',
      documentType: 'TECHNICAL_REPORT',
      releaseDate: '2026-10-13',
      modelName: 'Model',
      issueName: 'Issue',
      publicId: 'TR-invalid'
    })
    const qualityIssueUpdate = updateQualityIssueSchema.safeParse({
      detail: 'Updated detail',
      publicId: 'QI-invalid'
    })
    const sampleDefectUpdate = updateSampleDefectSchema.safeParse({
      partName: 'Updated part',
      publicId: 'SD-invalid'
    })
    const technicalReportUpdate = updateTechnicalReportSchema.safeParse({
      issueName: 'Updated issue',
      releaseDate: '2026-10-13',
      publicId: 'TR-invalid'
    })

    for (const result of [
      qualityIssueInput,
      sampleDefectInput,
      technicalReportInput,
      qualityIssueUpdate,
      sampleDefectUpdate,
      technicalReportUpdate
    ]) {
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('publicId')
      }
    }
  })
})
