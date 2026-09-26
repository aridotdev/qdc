import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { createDatabase } from '../../server/database/client'
import {
  qualityIssueDetails,
  qualityIssues,
  sampleDefects,
  insertSampleDefectSchema
} from '../../server/database/schema'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')

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

describe('Quality Issue and Sample Defect schema', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let directory: string

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-quality-issue-'))
    database = await createDatabase(`file:${join(directory, 'test.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('runs the migration and applies the domain schemas', async () => {
    const tables = await database.client.execute({
      sql: 'SELECT name FROM sqlite_master WHERE type = ? AND name IN (?, ?, ?) ORDER BY name',
      args: ['table', 'quality_issues', 'quality_issue_details', 'sample_defects']
    })

    expect(tables.rows).toEqual([
      { name: 'quality_issue_details' },
      { name: 'quality_issues' },
      { name: 'sample_defects' }
    ])
  })

  it('uses OPEN by default and loads timeline details through the relation', async () => {
    const now = new Date().toISOString()
    const [issue] = await database.db.insert(qualityIssues).values({
      issueName: 'Cracked housing',
      modelName: 'MODEL-01',
      serialNumber: 'SN-001',
      tanggalKejadian: '2026-09-26',
      detail: 'Housing ditemukan retak.',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    }).returning()

    expect(issue?.status).toBe('OPEN')
    expect(issue).toBeDefined()

    await database.db.insert(qualityIssueDetails).values({
      issueId: issue!.id,
      tanggal: now,
      action: 'INITIAL_EVIDENCE',
      remark: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })

    const result = await database.db.query.qualityIssues.findFirst({
      where: { id: issue!.id },
      with: { details: true }
    })

    expect(result?.details).toHaveLength(1)
    expect(result?.details[0]?.action).toBe('INITIAL_EVIDENCE')
  })

  it('rejects an orphan detail and cascades details when the issue is deleted', async () => {
    const now = new Date().toISOString()

    await expect(database.db.insert(qualityIssueDetails).values({
      issueId: 999999,
      tanggal: now,
      action: 'INITIAL_EVIDENCE',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })).rejects.toThrow()

    const [issue] = await database.db.insert(qualityIssues).values({
      issueName: 'Broken connector',
      modelName: 'MODEL-02',
      serialNumber: 'SN-002',
      tanggalKejadian: '2026-09-26',
      detail: 'Connector tidak terkunci.',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    }).returning({ id: qualityIssues.id })

    await database.db.insert(qualityIssueDetails).values({
      issueId: issue!.id,
      tanggal: now,
      action: 'INITIAL_EVIDENCE',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })

    await database.db.delete(qualityIssues).where(eq(qualityIssues.id, issue!.id))

    const remainingDetails = await database.db
      .select({ id: qualityIssueDetails.id })
      .from(qualityIssueDetails)
      .where(eq(qualityIssueDetails.issueId, issue!.id))

    expect(remainingDetails).toEqual([])
  })

  it('stores a valid Sample Defect with REQUESTED as the default status', async () => {
    const now = new Date().toISOString()
    const [sample] = await database.db.insert(sampleDefects).values({
      batchId: 'batch-001',
      notificationNumber: 'N-001',
      modelName: 'MODEL-01',
      serialNumber: 'SN-001',
      cabang: 'Jakarta',
      partNumber: 'PART-001',
      partName: 'Housing',
      kerusakanCabang: 'Retak',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    }).returning()

    expect(sample?.status).toBe('REQUESTED')
    expect(sample?.batchId).toBe('batch-001')
  })

  it('rejects invalid required fields and non-canonical enum values', async () => {
    const now = new Date().toISOString()

    const invalidFieldResult = insertSampleDefectSchema.safeParse({
      batchId: '',
      notificationNumber: 'N-002',
      modelName: 'MODEL-01',
      serialNumber: 'SN-002',
      cabang: 'Bandung',
      partNumber: 'PART-002',
      partName: 'Connector',
      kerusakanCabang: 'Longgar'
    })

    expect(invalidFieldResult.success).toBe(false)

    await expect(database.db.insert(sampleDefects).values({
      batchId: 'batch-002',
      notificationNumber: 'N-002',
      modelName: 'MODEL-01',
      serialNumber: 'SN-002',
      cabang: 'Bandung',
      partNumber: 'PART-002',
      partName: 'Connector',
      kerusakanCabang: 'Longgar',
      status: 'INVALID_STATUS',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })).rejects.toThrow()

    await expect(database.db.insert(sampleDefects).values({
      batchId: 'batch-003',
      notificationNumber: 'N-003',
      modelName: 'MODEL-01',
      serialNumber: 'SN-003',
      cabang: 'Surabaya',
      partNumber: 'PART-003',
      partName: 'Bracket',
      kerusakanCabang: 'Patah',
      kondisiPqa: 'INVALID_CONDITION',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })).rejects.toThrow()
  })

  it('rejects an invalid issue FK and nulls issue_id on issue deletion', async () => {
    const now = new Date().toISOString()

    await expect(database.db.insert(sampleDefects).values({
      batchId: 'batch-004',
      issueId: 999999,
      notificationNumber: 'N-004',
      modelName: 'MODEL-02',
      serialNumber: 'SN-004',
      cabang: 'Medan',
      partNumber: 'PART-004',
      partName: 'Cover',
      kerusakanCabang: 'Penyok',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })).rejects.toThrow()

    const [issue] = await database.db.insert(qualityIssues).values({
      issueName: 'Damaged sample',
      modelName: 'MODEL-02',
      serialNumber: 'SN-004',
      tanggalKejadian: '2026-09-26',
      detail: 'Sample memiliki kerusakan.',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    }).returning({ id: qualityIssues.id })

    const [sample] = await database.db.insert(sampleDefects).values({
      batchId: 'batch-005',
      issueId: issue!.id,
      notificationNumber: 'N-005',
      modelName: 'MODEL-02',
      serialNumber: 'SN-005',
      cabang: 'Semarang',
      partNumber: 'PART-005',
      partName: 'Panel',
      kerusakanCabang: 'Baret',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    }).returning({ id: sampleDefects.id })

    await database.db.delete(qualityIssues).where(eq(qualityIssues.id, issue!.id))

    const [remainingSample] = await database.db
      .select({ issueId: sampleDefects.issueId })
      .from(sampleDefects)
      .where(eq(sampleDefects.id, sample!.id))

    expect(remainingSample?.issueId).toBeNull()
  })
})
