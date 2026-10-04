import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDatabase } from '../../server/database/client'
import { qualityIssueDetails } from '../../server/database/schema'
import { createQualityIssueRepository } from '../../server/repositories/quality-issues'
import { qualityIssuePaginationSchema } from '../../shared/validators/quality-issues'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')

describe('quality issue repository', () => {
  const temporaryDirectories: string[] = []
  let database: Awaited<ReturnType<typeof createDatabase>>
  let repository: ReturnType<typeof createQualityIssueRepository>

  beforeAll(async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qdc-quality-issue-repository-'))
    temporaryDirectories.push(directory)
    database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
    repository = createQualityIssueRepository({ db: database.db })
  })

  afterAll(async () => {
    database?.client.close()
    await Promise.all(
      temporaryDirectories.map(directory => rm(directory, { recursive: true, force: true }))
    )
  })

  it('supports CRUD and returns undefined for missing records', async () => {
    const now = new Date().toISOString()
    const created = await repository.create({
      issueName: 'Initial issue',
      modelName: 'MODEL-01',
      serialNumber: 'SN-001',
      tanggalKejadian: '2026-10-01',
      notificationNumber: 'N-001',
      detail: 'Initial detail',
      keterangan: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })

    expect(created.status).toBe('OPEN')
    expect(await repository.findById(created.id)).toMatchObject({
      id: created.id,
      issueName: 'Initial issue'
    })

    const updated = await repository.update(created.id, {
      detail: 'Updated detail',
      updatedAt: now,
      updatedByUserId: 'user-2'
    })
    expect(updated).toMatchObject({
      id: created.id,
      detail: 'Updated detail',
      updatedByUserId: 'user-2'
    })

    expect(await repository.delete(created.id)).toMatchObject({ id: created.id })
    expect(await repository.findById(created.id)).toBeUndefined()
    expect(await repository.update(created.id, { detail: 'No row' })).toBeUndefined()
    expect(await repository.delete(created.id)).toBeUndefined()
  })

  it('filters, searches, sorts, paginates, and returns total count', async () => {
    const now = new Date().toISOString()
    await Promise.all([
      repository.create({
        issueName: 'Brake noise',
        modelName: 'MODEL-B',
        serialNumber: 'SN-002',
        tanggalKejadian: '2026-10-03',
        notificationNumber: 'N-002',
        detail: 'Noise after service',
        keterangan: null,
        status: 'IN_PROGRESS',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      }),
      repository.create({
        issueName: 'Door scratch',
        modelName: 'MODEL-A',
        serialNumber: 'SN-003',
        tanggalKejadian: '2026-10-02',
        notificationNumber: 'N-003',
        detail: 'Paint scratch',
        keterangan: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      }),
      repository.create({
        issueName: 'Engine vibration',
        modelName: 'MODEL-C',
        serialNumber: 'SN-004',
        tanggalKejadian: '2026-10-01',
        notificationNumber: 'N-004',
        detail: 'Vibration at idle',
        keterangan: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
    ])

    const result = await repository.list(
      qualityIssuePaginationSchema.parse({
        page: 1,
        limit: 1,
        search: 'scratch',
        sortBy: 'tanggalKejadian',
        sortDirection: 'asc',
        status: 'OPEN',
        tanggal_kejadian_from: '2026-10-01',
        tanggal_kejadian_to: '2026-10-03'
      })
    )

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      issueName: 'Door scratch',
      modelName: 'MODEL-A'
    })
    expect(result.meta).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1
    })

    const sorted = await repository.list(
      qualityIssuePaginationSchema.parse({
        limit: 2,
        sortBy: 'tanggalKejadian',
        sortDirection: 'asc'
      })
    )

    expect(sorted.items.map(issue => issue.issueName)).toEqual([
      'Engine vibration',
      'Door scratch'
    ])
    expect(sorted.meta).toMatchObject({ total: 3, totalPages: 2 })
  })

  it('returns timeline details in deterministic chronological order', async () => {
    const now = new Date().toISOString()
    const issue = await repository.create({
      issueName: 'Timeline issue',
      modelName: 'MODEL-T',
      serialNumber: 'SN-005',
      tanggalKejadian: '2026-10-05',
      notificationNumber: null,
      detail: 'Timeline detail',
      keterangan: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    })

    await database.db.insert(qualityIssueDetails).values([
      {
        issueId: issue.id,
        tanggal: '2026-10-03T00:00:00.000Z',
        action: 'LATER',
        remark: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      },
      {
        issueId: issue.id,
        tanggal: '2026-10-01T00:00:00.000Z',
        action: 'FIRST',
        remark: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      },
      {
        issueId: issue.id,
        tanggal: '2026-10-01T00:00:00.000Z',
        action: 'SECOND',
        remark: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      }
    ])

    const detail = await repository.findDetailById(issue.id)

    expect(detail?.details.map(item => item.action)).toEqual(['FIRST', 'SECOND', 'LATER'])
    expect(await repository.findDetailById(999999)).toBeUndefined()
  })
})
