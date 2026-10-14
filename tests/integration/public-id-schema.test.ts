import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDatabase } from '../../server/database/client'
import { migrateDatabase } from '../../server/database/migrate'
import { backfillPublicIds } from '../../server/database/public-id-backfill'
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
    await migrateDatabase(database, migrationsFolder)
    await backfillPublicIds(database)
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
      .returning({ id: qualityIssues.id, publicId: qualityIssues.publicId })

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
      .returning({ id: sampleDefects.id, publicId: sampleDefects.publicId })
    const [secondSample] = await database.db
      .insert(sampleDefects)
      .values({
        batchId: 'PUBLIC-ID-BATCH',
        notificationNumber: 'PUBLIC-ID-NOTIFICATION',
        modelName: 'MODEL-PUBLIC-ID',
        serialNumber: 'SN-PUBLIC-ID-2',
        cabang: 'Jakarta',
        partNumber: 'PART-PUBLIC-ID-2',
        partName: 'Second public ID part',
        kerusakanCabang: 'Schema test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: sampleDefects.id, publicId: sampleDefects.publicId })

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
      .returning({ id: technicalReports.id, publicId: technicalReports.publicId })

    const [storedIssue] = await database.db
      .select({ businessId: qualityIssues.businessId })
      .from(qualityIssues)
      .where(eq(qualityIssues.id, issue!.id))
    const storedSamples = await database.db
      .select({ businessId: sampleDefects.businessId })
      .from(sampleDefects)
      .where(eq(sampleDefects.batchId, 'PUBLIC-ID-BATCH'))
      .orderBy(sampleDefects.id)
    const [storedReport] = await database.db
      .select({ businessId: technicalReports.businessId })
      .from(technicalReports)
      .where(eq(technicalReports.id, report!.id))

    expect(qualityIssuePublicIdSchema.safeParse(issue?.publicId).success).toBe(true)
    expect(sampleDefectPublicIdSchema.safeParse(sample?.publicId).success).toBe(true)
    expect(sampleDefectPublicIdSchema.safeParse(secondSample?.publicId).success).toBe(true)
    expect(secondSample?.publicId).not.toBe(sample?.publicId)
    expect(technicalReportPublicIdSchema.safeParse(report?.publicId).success).toBe(true)
    expect(storedIssue?.businessId).toBe('QI-20261013-001')
    expect(storedSamples.map(row => row.businessId)).toEqual([
      'SD-20261013-001',
      'SD-20261013-002'
    ])
    expect(storedReport?.businessId).toBe('TR-20261013-001')
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
      publicId: 'QI-invalid',
      businessId: 'QI-20261013-001'
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
      publicId: 'SD-invalid',
      businessId: 'SD-20261013-001'
    })
    const technicalReportInput = insertTechnicalReportSchema.safeParse({
      documentNumber: 'Document',
      documentType: 'TECHNICAL_REPORT',
      releaseDate: '2026-10-13',
      modelName: 'Model',
      issueName: 'Issue',
      publicId: 'TR-invalid',
      businessId: 'TR-20261013-001'
    })
    const qualityIssueUpdate = updateQualityIssueSchema.safeParse({
      detail: 'Updated detail',
      publicId: 'QI-invalid',
      businessId: 'QI-20261013-001'
    })
    const sampleDefectUpdate = updateSampleDefectSchema.safeParse({
      partName: 'Updated part',
      publicId: 'SD-invalid',
      businessId: 'SD-20261013-001'
    })
    const technicalReportUpdate = updateTechnicalReportSchema.safeParse({
      issueName: 'Updated issue',
      releaseDate: '2026-10-13',
      publicId: 'TR-invalid',
      businessId: 'TR-20261013-001'
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
        expect(result.data).not.toHaveProperty('businessId')
      }
    }
  })
})
