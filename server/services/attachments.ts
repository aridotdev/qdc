import { ERROR_CODES } from '../../shared/constants'
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../../shared/constants/domain'
import type { createDatabase } from '../database/client'
import { attachments, insertAttachmentSchema, type Attachment } from '../database/schema'
import { eq } from 'drizzle-orm'
import type { FileStorage, StoredFile } from './file-storage'
import {
  validateAttachmentFile,
  type AttachmentFileInput,
  type ValidatedAttachmentFile
} from './file-policy'
import { recordAuditLog } from './audit-logs'

type AttachmentDatabase = Awaited<ReturnType<typeof createDatabase>>['db']

export interface AttachmentOwnerInput {
  detailId?: number | null
  sampleId?: number | null
  reportId?: number | null
}

export interface AttachmentUploadInput extends AttachmentOwnerInput {
  fileName: string
  mimeType: string
  data: Uint8Array
}

export interface AttachmentServiceConfig {
  db: AttachmentDatabase
  storage: FileStorage
  clock?: () => Date
}

export interface AttachmentMutationContext {
  actorUserId: string
}

export class InvalidAttachmentOwnerError extends Error {
  readonly code = ERROR_CODES.INVALID_ATTACHMENT_OWNER

  constructor() {
    super('Attachment harus memiliki tepat satu owner.')
    this.name = 'InvalidAttachmentOwnerError'
  }
}

export class AttachmentNotFoundError extends Error {
  readonly code = ERROR_CODES.NOT_FOUND

  constructor() {
    super('Attachment tidak ditemukan.')
    this.name = 'AttachmentNotFoundError'
  }
}

export class AttachmentFileReconciliationError extends Error {
  readonly code = ERROR_CODES.INTERNAL_ERROR
  readonly storageNames: string[]

  constructor(storageNames: string[], options?: { cause?: unknown }) {
    super('Metadata attachment berubah, tetapi cleanup file fisik gagal.')
    this.name = 'AttachmentFileReconciliationError'
    this.storageNames = storageNames

    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

export function countAttachmentOwners(owner: AttachmentOwnerInput): number {
  return [owner.detailId, owner.sampleId, owner.reportId].filter(
    value => value !== null && value !== undefined
  ).length
}

export function assertExactlyOneAttachmentOwner(owner: AttachmentOwnerInput): void {
  if (countAttachmentOwners(owner) !== 1) {
    throw new InvalidAttachmentOwnerError()
  }
}

function toAttachmentFileInput(input: AttachmentUploadInput): AttachmentFileInput {
  return {
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.data.byteLength
  }
}

function normalizeOwner(input: AttachmentOwnerInput): Required<AttachmentOwnerInput> {
  return {
    detailId: input.detailId ?? null,
    sampleId: input.sampleId ?? null,
    reportId: input.reportId ?? null
  }
}

async function cleanupStoredFiles(storage: FileStorage, storageNames: string[]): Promise<void> {
  const failedStorageNames: string[] = []
  let failureCause: unknown

  for (const storageName of storageNames) {
    try {
      await storage.remove(storageName)
    } catch (error) {
      failedStorageNames.push(storageName)
      failureCause ??= error
    }
  }

  if (failedStorageNames.length > 0) {
    throw new AttachmentFileReconciliationError(failedStorageNames, { cause: failureCause })
  }
}

function toStorageNameSet(attachmentRows: Array<Pick<Attachment, 'storageName'>>): Set<string> {
  return new Set(attachmentRows.map(attachment => attachment.storageName))
}

interface PreparedUpload {
  owner: Required<AttachmentOwnerInput>
  file: ValidatedAttachmentFile
  stored: StoredFile
}

export function createAttachmentService(config: AttachmentServiceConfig) {
  const clock = config.clock ?? (() => new Date())

  async function createAttachment(
    input: AttachmentUploadInput,
    context: AttachmentMutationContext
  ): Promise<Attachment> {
    const [attachment] = await createAttachments([input], context)

    if (!attachment) {
      throw new Error('Attachment gagal dibuat.')
    }

    return attachment
  }

  async function createAttachments(
    inputs: AttachmentUploadInput[],
    context: AttachmentMutationContext
  ): Promise<Attachment[]> {
    const writtenFiles: StoredFile[] = []

    try {
      const preparedUploads: PreparedUpload[] = []

      for (const input of inputs) {
        const owner = normalizeOwner(input)
        assertExactlyOneAttachmentOwner(owner)

        const file = validateAttachmentFile(toAttachmentFileInput(input))
        const stored = await config.storage.write(input.data)
        writtenFiles.push(stored)

        preparedUploads.push({
          owner,
          file,
          stored
        })
      }

      return await config.db.transaction(async (transaction) => {
        const now = clock().toISOString()
        const insertedAttachments: Attachment[] = []

        for (const upload of preparedUploads) {
          const metadata = insertAttachmentSchema.parse({
            ...upload.owner,
            fileName: upload.file.fileName,
            storageName: upload.stored.storageName,
            fileUrl: upload.stored.fileUrl,
            fileType: upload.file.fileType,
            fileSize: upload.file.fileSize
          })
          const [attachment] = await transaction
            .insert(attachments)
            .values({
              ...metadata,
              createdAt: now,
              updatedAt: now,
              createdByUserId: context.actorUserId,
              updatedByUserId: context.actorUserId
            })
            .returning()

          if (!attachment) {
            throw new Error('Metadata attachment gagal dibuat.')
          }

          await recordAuditLog(transaction, {
            entityType: AUDIT_ENTITY_TYPE.ATTACHMENT,
            entityId: attachment.id,
            action: AUDIT_ACTION.UPLOAD,
            actorUserId: context.actorUserId,
            createdAt: now
          })

          insertedAttachments.push(attachment)
        }

        return insertedAttachments
      })
    } catch (error) {
      if (writtenFiles.length > 0) {
        await cleanupStoredFiles(
          config.storage,
          writtenFiles.map(file => file.storageName)
        )
      }

      throw error
    }
  }

  async function deleteAttachment(
    attachmentId: number,
    context: AttachmentMutationContext
  ): Promise<Attachment> {
    const deletedAttachment = await config.db.transaction(async (transaction) => {
      const [attachment] = await transaction
        .select()
        .from(attachments)
        .where(eq(attachments.id, attachmentId))
        .limit(1)

      if (!attachment) {
        throw new AttachmentNotFoundError()
      }

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.ATTACHMENT,
        entityId: attachment.id,
        action: AUDIT_ACTION.DELETE,
        actorUserId: context.actorUserId,
        createdAt: clock().toISOString()
      })

      await transaction
        .delete(attachments)
        .where(eq(attachments.id, attachment.id))

      return attachment
    })

    try {
      await config.storage.remove(deletedAttachment.storageName)
    } catch (error) {
      throw new AttachmentFileReconciliationError([deletedAttachment.storageName], {
        cause: error
      })
    }

    return deletedAttachment
  }

  async function getAttachment(attachmentId: number): Promise<Attachment> {
    const [attachment] = await config.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId))
      .limit(1)

    if (!attachment) {
      throw new AttachmentNotFoundError()
    }

    return attachment
  }

  async function cleanupOrphanFiles(): Promise<string[]> {
    const storedFiles = await config.storage.list()
    const attachmentRows = await config.db
      .select({ storageName: attachments.storageName })
      .from(attachments)
    const knownStorageNames = toStorageNameSet(attachmentRows)
    const orphanStorageNames = storedFiles.filter(
      storageName => !knownStorageNames.has(storageName)
    )

    await cleanupStoredFiles(config.storage, orphanStorageNames)

    return orphanStorageNames
  }

  return {
    storage: config.storage,
    createAttachment,
    createAttachments,
    deleteAttachment,
    getAttachment,
    cleanupOrphanFiles
  }
}
