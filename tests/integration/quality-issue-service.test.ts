import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import {
  AUDIT_ACTION,
  QUALITY_ISSUE_DETAIL_ACTION,
  QUALITY_ISSUE_STATUS
} from '../../shared/constants'
import { createDatabase } from '../../server/database/client'
import {
  attachments,
  auditLogs,
  qualityIssueDetails,
  qualityIssues
} from '../../server/database/schema'
import { createAttachmentService } from '../../server/services/attachments'
import { createFileStorage, type FileStorage } from '../../server/services/file-storage'
import { createQualityIssueService } from '../../server/services/quality-issues'
import { qualityIssuePublicIdSchema } from '../../shared/validators/public-id'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const now = '2026-10-08T00:00:00.000Z'
const actorUserId = 'user-1'

describe('Quality Issue service', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let directory: string
  let storageRoot: string
  let nextFileId = 0

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-quality-issue-service-'))
    storageRoot = join(directory, 'uploads')
    database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  function createService(
    storage: FileStorage = createFileStorage({
      rootDir: storageRoot,
      clock: () => new Date(now),
      idGenerator: () => {
        nextFileId += 1
        return `file-${nextFileId}`
      }
    })
  ) {
    const attachmentService = createAttachmentService({
      db: database.db,
      storage,
      clock: () => new Date(now)
    })

    return createQualityIssueService({
      db: database.db,
      attachments: attachmentService,
      clock: () => new Date(now)
    })
  }

  async function getIssueDetails(issueId: number) {
    return database.db
      .select()
      .from(qualityIssueDetails)
      .where(eq(qualityIssueDetails.issueId, issueId))
  }

  it('creates an OPEN issue with initial evidence detail without attachment', async () => {
    const service = createService()
    const result = await service.create(
      {
        issueName: 'Initial no attachment',
        modelName: 'MODEL-QI',
        serialNumber: 'SN-QI-001',
        tanggalKejadian: '2026-10-08',
        notificationNumber: 'N-QI-001',
        detail: 'Issue detail'
      },
      { actorUserId }
    )

    const [issue] = await database.db
      .select()
      .from(qualityIssues)
      .where(eq(qualityIssues.id, result.issueId))
    const details = await getIssueDetails(result.issueId)
    const issueLogs = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, result.issueId))

    expect(issue).toMatchObject({
      businessId: 'QI-20261008-001',
      status: QUALITY_ISSUE_STATUS.OPEN,
      issueName: 'Initial no attachment',
      updatedByUserId: actorUserId
    })
    expect(qualityIssuePublicIdSchema.safeParse(issue?.publicId).success).toBe(true)
    expect(result.publicId).toBe(issue?.publicId)
    expect(result.businessId).toBe('QI-20261008-001')
    expect(details).toHaveLength(1)
    expect(details[0]).toMatchObject({
      id: result.detailId,
      action: QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE,
      tanggal: now
    })
    expect(result.attachmentIds).toEqual([])
    expect(issueLogs.some(log => log.action === AUDIT_ACTION.CREATE)).toBe(true)
  })

  it('creates initial evidence attachment owned by the initial detail', async () => {
    const service = createService()
    const result = await service.create(
      {
        issueName: 'Initial with attachment',
        modelName: 'MODEL-QI',
        serialNumber: 'SN-QI-002',
        tanggalKejadian: '2026-10-08',
        detail: 'Issue with attachment',
        attachments: [
          {
            fileName: 'initial.png',
            mimeType: 'image/png',
            data: new TextEncoder().encode('initial evidence')
          }
        ]
      },
      { actorUserId }
    )

    const [attachment] = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, result.attachmentIds[0]!))

    expect(attachment).toMatchObject({
      detailId: result.detailId,
      fileName: 'initial.png',
      storageName: 'quality-issue/2026/QI-20261008-002/file-1',
      fileUrl: `/api/attachments/${attachment!.id}`
    })
    expect(await readFile(join(storageRoot, attachment!.storageName), 'utf8')).toBe(
      'initial evidence'
    )
  })

  it('adds progress timeline and progress attachment with correct owner', async () => {
    const service = createService()
    const created = await service.create(
      {
        issueName: 'Progress issue',
        modelName: 'MODEL-QI',
        serialNumber: 'SN-QI-003',
        tanggalKejadian: '2026-10-08',
        detail: 'Issue for progress'
      },
      { actorUserId }
    )

    const progress = await service.addProgress(
      created.issueId,
      {
        tanggal: '2026-10-08T01:00:00.000Z',
        action: 'INVESTIGATION',
        remark: 'Checked customer unit',
        attachments: [
          {
            fileName: 'progress.png',
            mimeType: 'image/png',
            data: new TextEncoder().encode('progress evidence')
          }
        ]
      },
      { actorUserId }
    )

    const details = await getIssueDetails(created.issueId)
    const [updatedIssue] = await database.db
      .select()
      .from(qualityIssues)
      .where(eq(qualityIssues.id, created.issueId))
    const issueLogs = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, created.issueId))
    const [attachment] = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, progress.attachmentIds[0]!))

    expect(details.map(detail => detail.action)).toEqual([
      QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE,
      'INVESTIGATION'
    ])
    expect(updatedIssue?.status).toBe(QUALITY_ISSUE_STATUS.IN_PROGRESS)
    expect(issueLogs).toContainEqual(expect.objectContaining({
      action: AUDIT_ACTION.STATUS_CHANGE,
      fromStatus: QUALITY_ISSUE_STATUS.OPEN,
      toStatus: QUALITY_ISSUE_STATUS.IN_PROGRESS
    }))
    expect(attachment).toMatchObject({
      detailId: progress.detailId,
      fileName: 'progress.png'
    })
  })

  it('updates progress data and replaces selected attachments', async () => {
    const service = createService()
    const created = await service.create(
      {
        issueName: 'Editable progress issue',
        modelName: 'MODEL-QI',
        serialNumber: 'SN-QI-EDIT-PROGRESS',
        tanggalKejadian: '2026-10-08',
        detail: 'Issue for editable progress'
      },
      { actorUserId }
    )
    const progress = await service.addProgress(
      created.issueId,
      {
        action: 'INVESTIGATION',
        attachments: [{
          fileName: 'old-progress.png',
          mimeType: 'image/png',
          data: new TextEncoder().encode('old progress')
        }]
      },
      { actorUserId }
    )
    const [oldAttachment] = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, progress.attachmentIds[0]!))

    await service.updateProgress(
      created.issueId,
      progress.detailId,
      {
        action: 'CORRECTIVE_ACTION',
        remark: 'Updated progress remark',
        attachments: [{
          fileName: 'new-progress.png',
          mimeType: 'image/png',
          data: new TextEncoder().encode('new progress')
        }],
        removeAttachmentIds: [progress.attachmentIds[0]!]
      },
      { actorUserId }
    )

    const issue = await database.db
      .select()
      .from(qualityIssueDetails)
      .where(eq(qualityIssueDetails.id, progress.detailId))
    const detailAttachments = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.detailId, progress.detailId))
    const detailLogs = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, progress.detailId))

    expect(issue[0]).toMatchObject({
      action: 'CORRECTIVE_ACTION',
      remark: 'Updated progress remark'
    })
    expect(detailAttachments).toHaveLength(1)
    expect(detailAttachments[0]).toMatchObject({ fileName: 'new-progress.png' })
    expect(detailLogs).toContainEqual(expect.objectContaining({ action: AUDIT_ACTION.UPDATE }))
    await expect(stat(join(storageRoot, oldAttachment!.storageName))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('removes created issue and detail when create attachment fails', async () => {
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
    const service = createService(failingStorage)
    const initialDetailCountBefore = await database.db
      .select()
      .from(qualityIssueDetails)
      .where(eq(qualityIssueDetails.action, QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE))

    await expect(
      service.create(
        {
          issueName: 'Create failure',
          modelName: 'MODEL-QI',
          serialNumber: 'SN-QI-FAIL-CREATE',
          tanggalKejadian: '2026-10-08',
          detail: 'Attachment should fail',
          attachments: [
            {
              fileName: 'failure.png',
              mimeType: 'image/png',
              data: new TextEncoder().encode('failure')
            }
          ]
        },
        { actorUserId }
      )
    ).rejects.toThrow('write failed')

    const orphanIssues = await database.db
      .select()
      .from(qualityIssues)
      .where(eq(qualityIssues.serialNumber, 'SN-QI-FAIL-CREATE'))
    const initialDetailCountAfter = await database.db
      .select()
      .from(qualityIssueDetails)
      .where(eq(qualityIssueDetails.action, QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE))
    const orphanAttachments = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.fileName, 'failure.png'))

    expect(orphanIssues).toEqual([])
    expect(initialDetailCountAfter).toHaveLength(initialDetailCountBefore.length)
    expect(orphanAttachments).toEqual([])
  })

  it('removes progress detail when progress attachment fails', async () => {
    const service = createService()
    const created = await service.create(
      {
        issueName: 'Progress failure issue',
        modelName: 'MODEL-QI',
        serialNumber: 'SN-QI-FAIL-PROGRESS',
        tanggalKejadian: '2026-10-08',
        detail: 'Issue for failed progress'
      },
      { actorUserId }
    )
    const failingService = createService({
      rootDir: storageRoot,
      publicPath: '/uploads',
      resolvePath: storageName => join(storageRoot, storageName),
      write: async () => {
        throw new Error('write failed')
      },
      remove: async () => {},
      list: async () => []
    })

    await expect(
      failingService.addProgress(
        created.issueId,
        {
          action: 'FAILED_PROGRESS',
          attachments: [
            {
              fileName: 'progress-failure.png',
              mimeType: 'image/png',
              data: new TextEncoder().encode('failure')
            }
          ]
        },
        { actorUserId }
      )
    ).rejects.toThrow('write failed')

    const details = await getIssueDetails(created.issueId)
    const [issue] = await database.db
      .select()
      .from(qualityIssues)
      .where(eq(qualityIssues.id, created.issueId))

    expect(details.map(detail => detail.action)).toEqual([
      QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE
    ])
    expect(issue?.status).toBe(QUALITY_ISSUE_STATUS.OPEN)
    await expect(stat(join(storageRoot, '2026/10/08/progress-failure'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('updates an issue without changing its status and records an audit event', async () => {
    const service = createService()
    const created = await service.create({
      issueName: 'Update issue',
      modelName: 'MODEL-QI',
      serialNumber: 'SN-QI-UPDATE',
      tanggalKejadian: '2026-10-08',
      detail: 'Before update'
    }, { actorUserId })

    const updated = await service.update(created.issueId, {
      detail: 'After update',
      keterangan: 'Additional context'
    }, { actorUserId })

    expect(updated).toMatchObject({
      detail: 'After update',
      keterangan: 'Additional context',
      status: QUALITY_ISSUE_STATUS.OPEN,
      updatedByUserId: actorUserId
    })
    expect(updated.publicId).toBe(created.publicId)

    const logs = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, created.issueId))

    expect(logs.some(log => log.action === AUDIT_ACTION.UPDATE)).toBe(true)
  })

  it('deletes progress detail, attachments, physical files, and audit logs', async () => {
    const service = createService()
    const created = await service.create({
      issueName: 'Delete progress issue',
      modelName: 'MODEL-QI',
      serialNumber: 'SN-QI-DELETE-PROGRESS',
      tanggalKejadian: '2026-10-08',
      detail: 'Issue with deletable progress'
    }, { actorUserId })
    const progress = await service.addProgress(created.issueId, {
      action: 'TO_DELETE',
      attachments: [{
        fileName: 'delete-progress.png',
        mimeType: 'image/png',
        data: new TextEncoder().encode('delete progress')
      }]
    }, { actorUserId })
    const [attachment] = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, progress.attachmentIds[0]!))

    await service.removeProgress(created.issueId, progress.detailId, { actorUserId })

    expect(await database.db
      .select()
      .from(qualityIssueDetails)
      .where(eq(qualityIssueDetails.id, progress.detailId))).toEqual([])
    expect(await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, progress.attachmentIds[0]!))).toEqual([])
    const logs = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, progress.detailId))
    expect(logs.some(log => log.action === AUDIT_ACTION.DELETE)).toBe(true)
    await expect(stat(join(storageRoot, attachment!.storageName))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('does not delete initial evidence as a progress detail', async () => {
    const service = createService()
    const created = await service.create({
      issueName: 'Protected initial evidence',
      modelName: 'MODEL-QI',
      serialNumber: 'SN-QI-PROTECTED-DETAIL',
      tanggalKejadian: '2026-10-08',
      detail: 'Initial evidence must remain'
    }, { actorUserId })

    await expect(service.removeProgress(created.issueId, created.detailId, { actorUserId }))
      .rejects.toThrow('Detail awal Quality Issue tidak dapat dihapus.')
  })

  it('soft deletes an issue while preserving timeline attachments and physical files', async () => {
    const service = createService()
    const created = await service.create({
      issueName: 'Delete issue',
      modelName: 'MODEL-QI',
      serialNumber: 'SN-QI-DELETE',
      tanggalKejadian: '2026-10-08',
      detail: 'Issue to delete',
      attachments: [
        {
          fileName: 'delete-issue.png',
          mimeType: 'image/png',
          data: new TextEncoder().encode('delete issue evidence')
        }
      ]
    }, { actorUserId })
    const [attachment] = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, created.attachmentIds[0]!))

    await service.remove(created.issueId, { actorUserId }, { reason: 'Duplicate issue' })

    expect(await database.db
      .select()
      .from(qualityIssues)
      .where(eq(qualityIssues.id, created.issueId))).toMatchObject([{
      id: created.issueId,
      deletedByUserId: actorUserId,
      deletionReason: 'Duplicate issue'
    }])
    expect(await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, created.attachmentIds[0]!))).toHaveLength(1)
    await expect(stat(join(storageRoot, attachment!.storageName))).resolves.toBeDefined()

    await service.restore(created.issueId, { actorUserId })
    expect(await database.db
      .select()
      .from(qualityIssues)
      .where(eq(qualityIssues.id, created.issueId))).toMatchObject([{
      id: created.issueId,
      deletedAt: null,
      deletedByUserId: null
    }])
    const issueLogs = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, created.issueId))
    expect(issueLogs.some(log => log.action === AUDIT_ACTION.DELETE)).toBe(true)
    expect(issueLogs.some(log => log.action === AUDIT_ACTION.RESTORE)).toBe(true)
  })
})
