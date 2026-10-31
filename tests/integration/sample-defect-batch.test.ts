import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { count, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDatabase } from '../../server/database/client'
import { auditLogs, sampleDefects } from '../../server/database/schema'
import {
  createSampleDefectBatchService,
  SampleDefectBatchValidationError
} from '../../server/services/sample-defect-batch'
import { SAMPLE_DEFECT_STATUS } from '../../shared/constants'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const now = new Date('2026-10-31T00:00:00.000Z')

describe('Sample Defect batch service', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let service: ReturnType<typeof createSampleDefectBatchService>
  let directory: string

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-sample-defect-batch-'))
    database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
    service = createSampleDefectBatchService({
      db: database.db,
      clock: () => now
    })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  const input = {
    issueId: null,
    notificationNumber: 'NOTIF-BATCH',
    modelName: 'MODEL-BATCH',
    serialNumber: 'SN-BATCH',
    cabang: 'Jakarta',
    parts: [
      { partNumber: 'PART-01', partName: 'Part one', kerusakanCabang: 'Damage one' },
      { partNumber: 'PART-02', partName: 'Part two', kerusakanCabang: 'Damage two' },
      { partNumber: 'PART-03', partName: 'Part three', kerusakanCabang: 'Damage three' }
    ]
  }

  it('creates all parts with one batch ID and audit event per part', async () => {
    const result = await service.createBatch(input, 'user-1')

    expect(result.items).toHaveLength(3)
    expect(new Set(result.items.map(item => item.batchId))).toEqual(new Set([result.batchId]))
    expect(new Set(result.items.map(item => item.publicId)).size).toBe(3)
    expect(new Set(result.items.map(item => item.businessId)).size).toBe(3)
    expect(result.items.every(item => item.status === SAMPLE_DEFECT_STATUS.REQUESTED)).toBe(true)

    const events = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actorUserId, 'user-1'))
    expect(events).toHaveLength(3)
    expect(events.every(event => event.metadataJson?.includes(result.batchId))).toBe(true)
  })

  it('validates every part before starting a transaction', async () => {
    const before = await database.db.select({ total: count() }).from(sampleDefects)

    await expect(service.createBatch({
      ...input,
      parts: [
        input.parts[0],
        input.parts[1],
        { partNumber: '', partName: 'Invalid part', kerusakanCabang: 'Missing number' }
      ]
    }, 'user-2')).rejects.toBeInstanceOf(SampleDefectBatchValidationError)

    const after = await database.db.select({ total: count() }).from(sampleDefects)
    expect(after[0]?.total).toBe(before[0]?.total)
  })

  it('rolls back every part when a later insert fails', async () => {
    await database.client.execute(`
      CREATE TRIGGER fail_sample_defect_batch_part
      BEFORE INSERT ON sample_defects
      WHEN NEW.part_number = 'FAIL-PART'
      BEGIN
        SELECT RAISE(ABORT, 'forced batch failure');
      END
    `)

    const before = await database.db.select({ total: count() }).from(sampleDefects)
    await expect(service.createBatch({
      ...input,
      parts: [
        input.parts[0],
        input.parts[1],
        { partNumber: 'FAIL-PART', partName: 'Failure part', kerusakanCabang: 'Forced failure' }
      ]
    }, 'user-3')).rejects.toThrow()

    const after = await database.db.select({ total: count() }).from(sampleDefects)
    expect(after[0]?.total).toBe(before[0]?.total)
    await database.client.execute('DROP TRIGGER fail_sample_defect_batch_part')
  })

  it('can retry after a failed batch without leaving partial rows', async () => {
    const result = await service.createBatch(input, 'user-4')

    expect(result.items).toHaveLength(3)
    const rows = await database.db
      .select({ id: sampleDefects.id })
      .from(sampleDefects)
      .where(eq(sampleDefects.batchId, result.batchId))
    expect(rows).toHaveLength(3)
  })
})
