import { useRuntimeConfig } from '#imports'
import type { ZodType } from 'zod'
import { ERROR_CODES, AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../../shared/constants'
import { positiveIdSchema } from '../../shared/validators/common'
import db from '../database'
import { createAttachmentService } from '../services/attachments'
import { createFileStorage } from '../services/file-storage'
import { createSampleDefectBatchService } from '../services/sample-defect-batch'
import { createSampleDefectStateMachine } from '../services/sample-defect-state-machine'
import { recordAuditLog } from '../services/audit-logs'
import { createSampleDefectRepository } from '../repositories/sample-defects'
import { createApiError, createValidationError } from './api-error'

type SampleDefectEvent = Parameters<Parameters<typeof eventHandler>[0]>[0]

export interface ParsedSampleDefectPayload<T> {
  payload: T
  files: Array<{
    fileName: string
    mimeType: string
    data: Uint8Array
  }>
}

export function parseSampleDefectId(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'ID Sample Defect tidak valid.',
      fieldErrors: { id: ['ID Sample Defect tidak valid.'] }
    })
  }

  const result = positiveIdSchema.safeParse(Number(value))

  if (!result.success) {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'ID Sample Defect tidak valid.',
      fieldErrors: { id: ['ID Sample Defect tidak valid.'] }
    })
  }

  return result.data
}

export function createRuntimeSampleDefectRepository() {
  return createSampleDefectRepository({ db })
}

export function createRuntimeSampleDefectBatchService() {
  return createSampleDefectBatchService({ db })
}

export function createRuntimeSampleDefectStateMachine() {
  const config = useRuntimeConfig()

  return createSampleDefectStateMachine({
    db,
    attachments: createAttachmentService({
      db,
      storage: createFileStorage({ rootDir: config.storageRoot })
    })
  })
}

export async function getSampleDefectDetailOrThrow(sampleId: number) {
  const sample = await createRuntimeSampleDefectRepository().findDetailById(sampleId)

  if (!sample) {
    throw createApiError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Sample Defect ${sampleId} tidak ditemukan.`
    })
  }

  return sample
}

export async function deleteSampleDefect(sampleId: number, actorUserId: string): Promise<void> {
  await db.transaction(async (transaction) => {
    const repository = createSampleDefectRepository({ db: transaction })
    const deleted = await repository.hardDelete(sampleId)

    if (!deleted) {
      throw createApiError({
        code: ERROR_CODES.NOT_FOUND,
        message: `Sample Defect ${sampleId} tidak ditemukan.`
      })
    }

    await recordAuditLog(transaction, {
      entityType: AUDIT_ENTITY_TYPE.SAMPLE_DEFECT,
      entityId: sampleId,
      action: AUDIT_ACTION.DELETE,
      actorUserId,
      createdAt: new Date().toISOString()
    })
  })
}

function parseMultipartFields(
  parts: Awaited<ReturnType<typeof readMultipartFormData>>
): ParsedSampleDefectPayload<unknown> {
  const fields: Record<string, string> = {}
  const files: ParsedSampleDefectPayload<unknown>['files'] = []

  for (const part of parts ?? []) {
    if (!part.name) {
      continue
    }

    if (part.filename) {
      files.push({
        fileName: part.filename,
        mimeType: part.type ?? '',
        data: part.data
      })
      continue
    }

    fields[part.name] = new TextDecoder().decode(part.data)
  }

  return { payload: fields, files }
}

export async function readSampleDefectPayload<T>(
  event: SampleDefectEvent,
  schema: ZodType<T>
): Promise<ParsedSampleDefectPayload<T>> {
  const contentType = (getRequestHeader(event, 'content-type') ?? '').toLowerCase()
  const parsed = contentType.startsWith('multipart/form-data')
    ? parseMultipartFields(await readMultipartFormData(event))
    : { payload: await readBody(event), files: [] }

  const result = schema.safeParse(parsed.payload)

  if (!result.success) {
    throw createValidationError(result.error)
  }

  return {
    payload: result.data,
    files: parsed.files
  }
}

export function requireSinglePhoto(
  files: ParsedSampleDefectPayload<unknown>['files']
) {
  if (files.length > 1) {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Maksimal satu foto PQA dapat dikirim.',
      fieldErrors: { photo: ['Maksimal satu foto PQA dapat dikirim.'] }
    })
  }

  return files[0]
}
