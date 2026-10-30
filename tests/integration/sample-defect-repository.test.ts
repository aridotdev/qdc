import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDatabase } from '../../server/database/client'
import { createSampleDefectRepository } from '../../server/repositories/sample-defects'
import { sampleDefectPaginationSchema } from '../../shared/validators/sample-defects'
import { sampleDefectPublicIdSchema } from '../../shared/validators/public-id'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')

describe('sample defect repository', () => {
  const temporaryDirectories: string[] = []
  let database: Awaited<ReturnType<typeof createDatabase>>
  let repository: ReturnType<typeof createSampleDefectRepository>

  beforeAll(async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qdc-sample-defect-repository-'))
    temporaryDirectories.push(directory)
    database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
    repository = createSampleDefectRepository({ db: database.db })
  })

  afterAll(async () => {
    database?.client.close()
    await Promise.all(
      temporaryDirectories.map(directory => rm(directory, { recursive: true, force: true }))
    )
  })

  it('supports CRUD, public ID lookup, detail, and batch lookup', async () => {
    const now = new Date().toISOString()
    const created = await repository.create({
      batchId: 'BATCH-CRUD',
      notificationNumber: 'NOTIF-CRUD',
      modelName: 'MODEL-CRUD',
      serialNumber: 'SN-CRUD',
      cabang: 'Jakarta',
      partNumber: 'PART-CRUD',
      partName: 'Part CRUD',
      kerusakanCabang: 'Damage CRUD',
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })

    expect(sampleDefectPublicIdSchema.safeParse(created.publicId).success).toBe(true)
    expect(await repository.findById(created.id)).toMatchObject({
      id: created.id,
      publicId: created.publicId,
      partNumber: 'PART-CRUD'
    })
    expect(await repository.findByPublicId(created.publicId)).toMatchObject({
      id: created.id,
      publicId: created.publicId
    })
    expect(await repository.findDetailById(created.id)).toMatchObject({
      id: created.id,
      attachments: []
    })
    expect(await repository.findByBatchId('BATCH-CRUD')).toHaveLength(1)

    const updated = await repository.update(created.id, {
      kerusakanCabang: 'Updated damage',
      updatedAt: now,
      updatedByUserId: 'user-2'
    })
    expect(updated).toMatchObject({
      id: created.id,
      kerusakanCabang: 'Updated damage',
      updatedByUserId: 'user-2'
    })

    expect(await repository.hardDelete(created.id)).toMatchObject({ id: created.id })
    expect(await repository.findById(created.id)).toBeUndefined()
    expect(await repository.update(created.id, { partName: 'Missing' })).toBeUndefined()
  })

  it('filters, searches, sorts, paginates, and returns total count', async () => {
    const now = new Date().toISOString()
    await Promise.all([
      repository.create({
        batchId: 'BATCH-LIST-A',
        notificationNumber: 'NOTIF-A',
        modelName: 'MODEL-B',
        serialNumber: 'SN-A',
        cabang: 'Jakarta',
        partNumber: 'PART-A',
        partName: 'Brake pad',
        kerusakanCabang: 'Noise from brake',
        status: 'RECEIVED',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      }),
      repository.create({
        batchId: 'BATCH-LIST-B',
        notificationNumber: 'NOTIF-B',
        modelName: 'MODEL-A',
        serialNumber: 'SN-B',
        cabang: 'Bandung',
        partNumber: 'PART-B',
        partName: 'Door trim',
        kerusakanCabang: 'Scratch on door',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      }),
      repository.create({
        batchId: 'BATCH-LIST-C',
        notificationNumber: 'NOTIF-C',
        modelName: 'MODEL-C',
        serialNumber: 'SN-C',
        cabang: 'Surabaya',
        partNumber: 'PART-C',
        partName: 'Engine mount',
        kerusakanCabang: 'Vibration at idle',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
    ])

    const result = await repository.list(
      sampleDefectPaginationSchema.parse({
        page: 1,
        limit: 1,
        search: 'Scratch',
        sortBy: 'modelName',
        sortDirection: 'asc'
      })
    )

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      modelName: 'MODEL-A',
      partName: 'Door trim'
    })
    expect(result.meta).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1
    })

    const filtered = await repository.list(
      sampleDefectPaginationSchema.parse({
        status: 'RECEIVED',
        model_name: 'MODEL-B',
        part_number: 'PART-A'
      })
    )
    expect(filtered.items).toHaveLength(1)
    expect(filtered.items[0]?.batchId).toBe('BATCH-LIST-A')

    const sorted = await repository.list(
      sampleDefectPaginationSchema.parse({
        limit: 2,
        sortBy: 'modelName',
        sortDirection: 'asc'
      })
    )
    expect(sorted.items.map(sample => sample.modelName)).toEqual(['MODEL-A', 'MODEL-B'])
    expect(sorted.meta).toMatchObject({ total: 3, totalPages: 2 })
  })
})
