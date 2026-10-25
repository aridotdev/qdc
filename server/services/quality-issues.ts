import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  ERROR_CODES,
  QUALITY_ISSUE_DETAIL_ACTION,
  QUALITY_ISSUE_STATUS
} from '../../shared/constants'
import type { createDatabase } from '../database/client'
import type { Attachment, QualityIssue } from '../database/schema'
import {
  createQualityIssueRepository,
  type CreateQualityIssueInput,
  type UpdateQualityIssueInput
} from '../repositories/quality-issues'
import { createBusinessId } from '../utils/business-id'
import { createPublicId } from '../utils/public-id'
import type {
  AttachmentStorageContext,
  createAttachmentService,
  AttachmentUploadInput
} from './attachments'
import { recordAuditLog } from './audit-logs'

type QualityIssueDatabase = Awaited<ReturnType<typeof createDatabase>>['db']
type AttachmentService = ReturnType<typeof createAttachmentService>

export interface QualityIssueFileInput {
  fileName: string
  mimeType: string
  data: Uint8Array
}

export interface CreateQualityIssueServiceInput {
  issueName: string
  modelName: string
  serialNumber: string
  tanggalKejadian: string
  notificationNumber?: string | null
  detail: string
  keterangan?: string | null
  attachments?: QualityIssueFileInput[]
}

export interface AddQualityIssueProgressInput {
  tanggal?: string
  action: string
  remark?: string | null
  attachments?: QualityIssueFileInput[]
}

export interface UpdateQualityIssueProgressInput {
  action: string
  remark?: string | null
  attachments?: QualityIssueFileInput[]
  removeAttachmentIds?: number[]
}

export type UpdateQualityIssueServiceInput = Pick<
  UpdateQualityIssueInput,
  | 'issueName'
  | 'modelName'
  | 'serialNumber'
  | 'tanggalKejadian'
  | 'notificationNumber'
  | 'detail'
  | 'keterangan'
>

export interface QualityIssueMutationContext {
  actorUserId: string
}

export interface QualityIssueDetailMutationResult {
  detailId: number
  attachmentIds: number[]
}

export interface CreateQualityIssueResult extends QualityIssueDetailMutationResult {
  issueId: number
  publicId: string
  businessId: string | null
}

export class QualityIssueServiceNotFoundError extends Error {
  readonly code = ERROR_CODES.NOT_FOUND

  constructor(issueId: number) {
    super(`Quality Issue ${issueId} tidak ditemukan.`)
    this.name = 'QualityIssueServiceNotFoundError'
  }
}

export class QualityIssueInitialEvidenceUpdateForbiddenError extends Error {
  readonly code = ERROR_CODES.FORBIDDEN

  constructor() {
    super('Detail awal Quality Issue atau action khususnya tidak dapat diedit.')
    this.name = 'QualityIssueInitialEvidenceUpdateForbiddenError'
  }
}

export class QualityIssueInitialEvidenceDeleteForbiddenError extends Error {
  readonly code = ERROR_CODES.FORBIDDEN

  constructor() {
    super('Detail awal Quality Issue tidak dapat dihapus.')
    this.name = 'QualityIssueInitialEvidenceDeleteForbiddenError'
  }
}

export class QualityIssueProgressAttachmentNotFoundError extends Error {
  readonly code = ERROR_CODES.NOT_FOUND

  constructor(attachmentId: number) {
    super(`Attachment ${attachmentId} bukan bagian dari progress Quality Issue.`)
    this.name = 'QualityIssueProgressAttachmentNotFoundError'
  }
}

export interface QualityIssueServiceConfig {
  db: QualityIssueDatabase
  attachments: AttachmentService
  clock?: () => Date
}

function toAttachmentInputs(
  detailId: number,
  attachments: QualityIssueFileInput[] | undefined,
  storageContext: AttachmentStorageContext
): AttachmentUploadInput[] {
  return (attachments ?? []).map(attachment => ({
    detailId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    data: attachment.data,
    storageContext
  }))
}

function toAttachmentIds(attachments: Attachment[]): number[] {
  return attachments.map(attachment => attachment.id)
}

function createAttachmentStorageContext(
  businessId: string | null,
  createdAt: string
): AttachmentStorageContext {
  if (!businessId) {
    throw new Error('Business ID laporan belum tersedia.')
  }

  return {
    section: 'quality-issue',
    reportYear: new Date(createdAt).getUTCFullYear(),
    businessId
  }
}

async function createDetailAttachments(
  service: AttachmentService,
  detailId: number,
  files: QualityIssueFileInput[] | undefined,
  context: QualityIssueMutationContext,
  storageContext: AttachmentStorageContext
): Promise<number[]> {
  if (!files || files.length === 0) {
    return []
  }

  const attachments = await service.createAttachments(
    toAttachmentInputs(detailId, files, storageContext),
    { actorUserId: context.actorUserId }
  )

  return toAttachmentIds(attachments)
}

export function createQualityIssueService(config: QualityIssueServiceConfig) {
  const clock = config.clock ?? (() => new Date())

  async function createInitialIssue(
    input: CreateQualityIssueServiceInput,
    context: QualityIssueMutationContext
  ): Promise<CreateQualityIssueResult> {
    const created = await config.db.transaction(async (transaction) => {
      const repository = createQualityIssueRepository({ db: transaction })
      const nowDate = clock()
      const now = nowDate.toISOString()
      const issueInput: CreateQualityIssueInput = {
        publicId: createPublicId('QI'),
        businessId: await createBusinessId(transaction, 'QI', nowDate),
        issueName: input.issueName,
        modelName: input.modelName,
        serialNumber: input.serialNumber,
        tanggalKejadian: input.tanggalKejadian,
        notificationNumber: input.notificationNumber ?? null,
        detail: input.detail,
        keterangan: input.keterangan ?? null,
        status: QUALITY_ISSUE_STATUS.OPEN,
        createdAt: now,
        updatedAt: now,
        createdByUserId: context.actorUserId,
        updatedByUserId: context.actorUserId
      }
      const issue = await repository.create(issueInput)
      const detail = await repository.createDetail({
        issueId: issue.id,
        tanggal: now,
        action: QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE,
        remark: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: context.actorUserId,
        updatedByUserId: context.actorUserId
      })

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
        entityId: issue.id,
        action: AUDIT_ACTION.CREATE,
        actorUserId: context.actorUserId,
        createdAt: now
      })
      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE_DETAIL,
        entityId: detail.id,
        action: AUDIT_ACTION.CREATE,
        metadata: { issueId: issue.id },
        actorUserId: context.actorUserId,
        createdAt: now
      })

      return {
        issueId: issue.id,
        publicId: issue.publicId,
        businessId: issue.businessId,
        detailId: detail.id,
        storageContext: createAttachmentStorageContext(issue.businessId, issue.createdAt)
      }
    })

    try {
      const { storageContext, ...result } = created

      return {
        ...result,
        attachmentIds: await createDetailAttachments(
          config.attachments,
          created.detailId,
          input.attachments,
          context,
          storageContext
        )
      }
    } catch (error) {
      await createQualityIssueRepository({ db: config.db }).delete(created.issueId)
      throw error
    }
  }

  async function addProgress(
    issueId: number,
    input: AddQualityIssueProgressInput,
    context: QualityIssueMutationContext
  ): Promise<QualityIssueDetailMutationResult> {
    const created = await config.db.transaction(async (transaction) => {
      const repository = createQualityIssueRepository({ db: transaction })
      const issue = await repository.findDetailById(issueId)

      if (!issue) {
        throw new QualityIssueServiceNotFoundError(issueId)
      }

      const shouldStartProgress = issue.status === QUALITY_ISSUE_STATUS.OPEN
        && !issue.details.some(detail => detail.action !== QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE)
      const now = clock().toISOString()
      const detail = await repository.createDetail({
        issueId,
        tanggal: input.tanggal ?? now,
        action: input.action,
        remark: input.remark ?? null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: context.actorUserId,
        updatedByUserId: context.actorUserId
      })

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE_DETAIL,
        entityId: detail.id,
        action: AUDIT_ACTION.CREATE,
        metadata: { issueId },
        actorUserId: context.actorUserId,
        createdAt: now
      })

      return {
        detailId: detail.id,
        storageContext: createAttachmentStorageContext(issue.businessId, issue.createdAt),
        shouldStartProgress
      }
    })

    try {
      const attachmentIds = await createDetailAttachments(
        config.attachments,
        created.detailId,
        input.attachments,
        context,
        created.storageContext
      )

      if (created.shouldStartProgress) {
        await config.db.transaction(async (transaction) => {
          const repository = createQualityIssueRepository({ db: transaction })
          const issue = await repository.findById(issueId)

          if (!issue || issue.status !== QUALITY_ISSUE_STATUS.OPEN) {
            return
          }

          const now = clock().toISOString()
          const updated = await repository.update(issueId, {
            status: QUALITY_ISSUE_STATUS.IN_PROGRESS,
            updatedAt: now,
            updatedByUserId: context.actorUserId
          })

          if (!updated) {
            throw new QualityIssueServiceNotFoundError(issueId)
          }

          await recordAuditLog(transaction, {
            entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
            entityId: issueId,
            action: AUDIT_ACTION.STATUS_CHANGE,
            fromStatus: QUALITY_ISSUE_STATUS.OPEN,
            toStatus: QUALITY_ISSUE_STATUS.IN_PROGRESS,
            actorUserId: context.actorUserId,
            createdAt: now
          })
        })
      }

      return { detailId: created.detailId, attachmentIds }
    } catch (error) {
      await createQualityIssueRepository({ db: config.db }).deleteDetail(created.detailId)
      throw error
    }
  }

  async function updateProgress(
    issueId: number,
    detailId: number,
    input: UpdateQualityIssueProgressInput,
    context: QualityIssueMutationContext
  ): Promise<QualityIssueDetailMutationResult> {
    const issue = await createQualityIssueRepository({ db: config.db }).findDetailById(issueId)

    if (!issue) {
      throw new QualityIssueServiceNotFoundError(issueId)
    }

    const detail = issue.details.find(item => item.id === detailId)

    if (!detail) {
      throw new QualityIssueServiceNotFoundError(detailId)
    }

    if (
      detail.action === QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE
      || input.action === QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE
    ) {
      throw new QualityIssueInitialEvidenceUpdateForbiddenError()
    }

    const removeAttachmentIds = [...new Set(input.removeAttachmentIds ?? [])]
    const attachmentsToRemove = removeAttachmentIds.map((attachmentId) => {
      const attachment = detail.attachments.find(item => item.id === attachmentId)

      if (!attachment) {
        throw new QualityIssueProgressAttachmentNotFoundError(attachmentId)
      }

      return attachment
    })
    const attachmentIds = await createDetailAttachments(
      config.attachments,
      detailId,
      input.attachments,
      context,
      createAttachmentStorageContext(issue.businessId, issue.createdAt)
    )

    const now = clock().toISOString()
    await config.db.transaction(async (transaction) => {
      const repository = createQualityIssueRepository({ db: transaction })
      const updated = await repository.updateDetail(detailId, {
        action: input.action,
        remark: input.remark ?? null,
        updatedAt: now,
        updatedByUserId: context.actorUserId
      })

      if (!updated) {
        throw new QualityIssueServiceNotFoundError(detailId)
      }

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE_DETAIL,
        entityId: detailId,
        action: AUDIT_ACTION.UPDATE,
        metadata: { fields: ['action', 'remark'] },
        actorUserId: context.actorUserId,
        createdAt: now
      })
    })

    for (const attachment of attachmentsToRemove) {
      await config.attachments.deleteAttachment(attachment.id, context)
    }

    return { detailId, attachmentIds }
  }

  async function removeProgress(
    issueId: number,
    detailId: number,
    context: QualityIssueMutationContext
  ): Promise<void> {
    const repository = createQualityIssueRepository({ db: config.db })
    const issue = await repository.findDetailById(issueId)

    if (!issue) {
      throw new QualityIssueServiceNotFoundError(issueId)
    }

    const detail = issue.details.find(item => item.id === detailId)

    if (!detail) {
      throw new QualityIssueServiceNotFoundError(detailId)
    }

    if (detail.action === QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE) {
      throw new QualityIssueInitialEvidenceDeleteForbiddenError()
    }

    for (const attachment of detail.attachments) {
      await config.attachments.deleteAttachment(attachment.id, context)
    }

    await config.db.transaction(async (transaction) => {
      const transactionRepository = createQualityIssueRepository({ db: transaction })
      const now = clock().toISOString()
      const deleted = await transactionRepository.deleteDetail(detailId)

      if (!deleted) {
        throw new QualityIssueServiceNotFoundError(detailId)
      }

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE_DETAIL,
        entityId: detailId,
        action: AUDIT_ACTION.DELETE,
        metadata: { issueId },
        actorUserId: context.actorUserId,
        createdAt: now
      })
    })
  }

  async function update(
    issueId: number,
    input: UpdateQualityIssueServiceInput,
    context: QualityIssueMutationContext
  ): Promise<QualityIssue> {
    return config.db.transaction(async (transaction) => {
      const repository = createQualityIssueRepository({ db: transaction })
      const issue = await repository.findById(issueId)

      if (!issue) {
        throw new QualityIssueServiceNotFoundError(issueId)
      }

      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
      ) as UpdateQualityIssueServiceInput
      const updated = await repository.update(issueId, {
        ...changes,
        updatedAt: clock().toISOString(),
        updatedByUserId: context.actorUserId
      })

      if (!updated) {
        throw new QualityIssueServiceNotFoundError(issueId)
      }

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
        entityId: issueId,
        action: AUDIT_ACTION.UPDATE,
        metadata: { fields: Object.keys(changes) },
        actorUserId: context.actorUserId,
        createdAt: updated.updatedAt
      })

      return updated
    })
  }

  async function remove(
    issueId: number,
    context: QualityIssueMutationContext
  ): Promise<QualityIssue> {
    const repository = createQualityIssueRepository({ db: config.db })
    const issue = await repository.findDetailById(issueId)

    if (!issue) {
      throw new QualityIssueServiceNotFoundError(issueId)
    }

    const attachmentIds = issue.details.flatMap(detail =>
      detail.attachments.map(attachment => attachment.id)
    )

    for (const attachmentId of attachmentIds) {
      await config.attachments.deleteAttachment(attachmentId, context)
    }

    return config.db.transaction(async (transaction) => {
      const transactionRepository = createQualityIssueRepository({ db: transaction })
      const now = clock().toISOString()
      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
        entityId: issueId,
        action: AUDIT_ACTION.DELETE,
        actorUserId: context.actorUserId,
        createdAt: now
      })

      const deleted = await transactionRepository.delete(issueId)

      if (!deleted) {
        throw new QualityIssueServiceNotFoundError(issueId)
      }

      return deleted
    })
  }

  return {
    create: createInitialIssue,
    addProgress,
    updateProgress,
    removeProgress,
    update,
    remove
  }
}
