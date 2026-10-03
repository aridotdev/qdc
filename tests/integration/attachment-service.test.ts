import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { createDatabase } from '../../server/database/client'
import {
  attachments,
  auditLogs,
  qualityIssueDetails,
  qualityIssues,
  sampleDefects
} from '../../server/database/schema'
import {
  AttachmentFileReconciliationError,
  AttachmentNotFoundError,
  createAttachmentService
} from '../../server/services/attachments'
import { createFileStorage, type FileStorage } from '../../server/services/file-storage'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const now = '2026-10-03T00:00:00.000Z'
const actorUserId = 'user-1'

describe('attachment service compensation', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let directory: string
  let storageRoot: string
  let detailId: number
  let sampleId: number

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-attachment-service-'))
    storageRoot = join(directory, 'uploads')
    database = await createDatabase(`file:${join(directory, 'test.sqlite')}`)
    await migrate(database.db, { migrationsFolder })

    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Attachment service issue',
        modelName: 'MODEL-ATTACHMENT-SERVICE',
        serialNumber: 'SN-ATTACHMENT-SERVICE',
        tanggalKejadian: '2026-10-03',
        detail: 'Issue untuk pengujian attachment service.',
        createdAt: now,
        updatedAt: now,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId
      })
      .returning({ id: qualityIssues.id })

    const [detail] = await database.db
      .insert(qualityIssueDetails)
      .values({
        issueId: issue!.id,
        tanggal: now,
        action: 'INITIAL_EVIDENCE',
        createdAt: now,
        updatedAt: now,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId
      })
      .returning({ id: qualityIssueDetails.id })

    const [sample] = await database.db
      .insert(sampleDefects)
      .values({
        batchId: 'attachment-service-batch',
        notificationNumber: 'ATTACHMENT-SERVICE',
        modelName: 'MODEL-ATTACHMENT-SERVICE',
        serialNumber: 'SN-ATTACHMENT-SERVICE',
        cabang: 'Jakarta',
        partNumber: 'PART-ATTACHMENT-SERVICE',
        partName: 'Attachment service test part',
        kerusakanCabang: 'Test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId
      })
      .returning({ id: sampleDefects.id })

    detailId = detail!.id
    sampleId = sample!.id
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('writes a file, inserts metadata, and records upload audit', async () => {
    const storage = createFileStorage({
      rootDir: storageRoot,
      clock: () => new Date(now),
      idGenerator: () => 'create-upload'
    })
    const service = createAttachmentService({
      db: database.db,
      storage,
      clock: () => new Date(now)
    })

    const attachment = await service.createAttachment({
      detailId,
      fileName: 'evidence.png',
      mimeType: 'image/png',
      data: new TextEncoder().encode('png data')
    }, { actorUserId })

    expect(attachment.storageName).toBe('2026/10/03/create-upload')
    expect(attachment.fileUrl).toBe('/uploads/2026/10/03/create-upload')
    expect(await readFile(storage.resolvePath(attachment.storageName), 'utf8')).toBe('png data')

    const uploadLogs = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, attachment.id))

    expect(uploadLogs.some(log => log.action === 'UPLOAD')).toBe(true)
  })

  it('does not insert metadata when file write fails', async () => {
    const failingStorage: FileStorage = {
      rootDir: storageRoot,
      publicPath: '/uploads',
      resolvePath: storageName => join(storageRoot, storageName),
      write: async () => {
        throw new Error('write failed')
      },
      remove: async () => {},
      list: async () => []
    }
    const service = createAttachmentService({
      db: database.db,
      storage: failingStorage,
      clock: () => new Date(now)
    })

    await expect(service.createAttachment({
      detailId,
      fileName: 'write-failure.png',
      mimeType: 'image/png',
      data: new TextEncoder().encode('png data')
    }, { actorUserId })).rejects.toThrow('write failed')

    const rows = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.fileName, 'write-failure.png'))

    expect(rows).toEqual([])
  })

  it('cleans up a written file when metadata insert fails', async () => {
    const storage = createFileStorage({
      rootDir: storageRoot,
      clock: () => new Date(now),
      idGenerator: () => 'db-failure'
    })
    const service = createAttachmentService({
      db: database.db,
      storage,
      clock: () => new Date(now)
    })

    await expect(service.createAttachment({
      sampleId: 999_999,
      fileName: 'db-failure.png',
      mimeType: 'image/png',
      data: new TextEncoder().encode('png data')
    }, { actorUserId })).rejects.toThrow()

    await expect(stat(storage.resolvePath('2026/10/03/db-failure')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('cleans up all written files when a batch upload fails', async () => {
    let id = 0
    const storage = createFileStorage({
      rootDir: storageRoot,
      clock: () => new Date(now),
      idGenerator: () => `batch-${++id}`
    })
    const service = createAttachmentService({
      db: database.db,
      storage,
      clock: () => new Date(now)
    })

    await expect(service.createAttachments([
      {
        detailId,
        fileName: 'batch-1.png',
        mimeType: 'image/png',
        data: new TextEncoder().encode('first')
      },
      {
        sampleId: 999_999,
        fileName: 'batch-2.png',
        mimeType: 'image/png',
        data: new TextEncoder().encode('second')
      }
    ], { actorUserId })).rejects.toThrow()

    await expect(stat(storage.resolvePath('2026/10/03/batch-1')))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(storage.resolvePath('2026/10/03/batch-2')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('deletes attachment metadata and physical file', async () => {
    const storage = createFileStorage({
      rootDir: storageRoot,
      clock: () => new Date(now),
      idGenerator: () => 'delete-upload'
    })
    const service = createAttachmentService({
      db: database.db,
      storage,
      clock: () => new Date(now)
    })
    const attachment = await service.createAttachment({
      detailId,
      fileName: 'delete.png',
      mimeType: 'image/png',
      data: new TextEncoder().encode('delete data')
    }, { actorUserId })

    const deleted = await service.deleteAttachment(attachment.id, { actorUserId: 'admin-1' })

    expect(deleted.id).toBe(attachment.id)
    await expect(stat(storage.resolvePath(attachment.storageName)))
      .rejects.toMatchObject({ code: 'ENOENT' })

    const metadata = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachment.id))
    const deleteLogs = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, attachment.id))

    expect(metadata).toEqual([])
    expect(deleteLogs.some(log => log.action === 'DELETE')).toBe(true)
  })

  it('raises a reconciliation error when physical delete fails after metadata delete', async () => {
    const storage = createFileStorage({
      rootDir: storageRoot,
      clock: () => new Date(now),
      idGenerator: () => 'delete-reconciliation'
    })
    const service = createAttachmentService({
      db: database.db,
      storage,
      clock: () => new Date(now)
    })
    const attachment = await service.createAttachment({
      detailId,
      fileName: 'delete-reconciliation.png',
      mimeType: 'image/png',
      data: new TextEncoder().encode('delete data')
    }, { actorUserId })
    const failingRemoveStorage: FileStorage = {
      ...storage,
      remove: async () => {
        throw new Error('remove failed')
      }
    }
    const failingService = createAttachmentService({
      db: database.db,
      storage: failingRemoveStorage,
      clock: () => new Date(now)
    })

    await expect(failingService.deleteAttachment(attachment.id, { actorUserId: 'admin-1' }))
      .rejects.toThrowError(AttachmentFileReconciliationError)

    const metadata = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachment.id))

    expect(metadata).toEqual([])
    expect(await readFile(storage.resolvePath(attachment.storageName), 'utf8'))
      .toBe('delete data')
  })

  it('cleans up orphan physical files and keeps files with metadata', async () => {
    let id = 0
    const storage = createFileStorage({
      rootDir: storageRoot,
      clock: () => new Date(now),
      idGenerator: () => `orphan-${++id}`
    })
    const service = createAttachmentService({
      db: database.db,
      storage,
      clock: () => new Date(now)
    })
    const keptAttachment = await service.createAttachment({
      sampleId,
      fileName: 'kept.png',
      mimeType: 'image/png',
      data: new TextEncoder().encode('kept')
    }, { actorUserId })
    const orphan = await storage.write(new TextEncoder().encode('orphan'))

    const cleaned = await service.cleanupOrphanFiles()

    expect(cleaned).toContain(orphan.storageName)
    expect(await readFile(storage.resolvePath(keptAttachment.storageName), 'utf8')).toBe('kept')
    await expect(stat(storage.resolvePath(orphan.storageName)))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects deleting a missing attachment', async () => {
    const storage = createFileStorage({ rootDir: storageRoot })
    const service = createAttachmentService({
      db: database.db,
      storage,
      clock: () => new Date(now)
    })

    await expect(service.deleteAttachment(999_999, { actorUserId: 'admin-1' }))
      .rejects.toThrowError(AttachmentNotFoundError)
  })
})
