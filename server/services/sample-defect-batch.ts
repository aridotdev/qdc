import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  ERROR_CODES,
  SAMPLE_DEFECT_STATUS
} from '../../shared/constants'
import type { FieldErrors } from '../../shared/errors'
import type { createDatabase } from '../database/client'
import type { SampleDefect } from '../database/schema'
import {
  createSampleDefectRepository,
  type CreateSampleDefectInput
} from '../repositories/sample-defects'
import { recordAuditLog } from './audit-logs'
import { createBusinessId } from '../utils/business-id'
import { createPublicId } from '../utils/public-id'
import { v7 as uuidv7 } from 'uuid'

type SampleDefectDatabase = Awaited<ReturnType<typeof createDatabase>>['db']

export interface SampleDefectBatchPartInput {
  partNumber: string
  partName: string
  kerusakanCabang: string
}

export interface CreateSampleDefectBatchInput {
  issueId?: number | null
  notificationNumber: string
  modelName: string
  serialNumber: string
  cabang: string
  parts: SampleDefectBatchPartInput[]
}

export interface CreateSampleDefectBatchResult {
  batchId: string
  items: SampleDefect[]
}

export interface SampleDefectBatchServiceConfig {
  db: SampleDefectDatabase
  clock?: () => Date
}

export class SampleDefectBatchValidationError extends Error {
  readonly code = ERROR_CODES.VALIDATION_ERROR
  readonly fieldErrors: FieldErrors

  constructor(fieldErrors: FieldErrors) {
    super('Data batch Sample Defect tidak valid.')
    this.name = 'SampleDefectBatchValidationError'
    this.fieldErrors = fieldErrors
  }
}

function addRequiredError(errors: FieldErrors, field: string): void {
  errors[field] ??= []
  errors[field].push('Field wajib diisi.')
}

function normalizeText(
  errors: FieldErrors,
  field: string,
  value: string | undefined
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    addRequiredError(errors, field)
    return ''
  }

  return value.trim()
}

function validateBatchInput(input: CreateSampleDefectBatchInput): CreateSampleDefectBatchInput {
  const errors: FieldErrors = {}
  const notificationNumber = normalizeText(errors, 'notificationNumber', input.notificationNumber)
  const modelName = normalizeText(errors, 'modelName', input.modelName)
  const serialNumber = normalizeText(errors, 'serialNumber', input.serialNumber)
  const cabang = normalizeText(errors, 'cabang', input.cabang)

  if (!Array.isArray(input.parts) || input.parts.length === 0) {
    errors.parts = ['Minimal satu part harus diisi.']
  }

  const parts = Array.isArray(input.parts)
    ? input.parts.map((part, index) => ({
        partNumber: normalizeText(errors, `parts.${index}.partNumber`, part?.partNumber),
        partName: normalizeText(errors, `parts.${index}.partName`, part?.partName),
        kerusakanCabang: normalizeText(
          errors,
          `parts.${index}.kerusakanCabang`,
          part?.kerusakanCabang
        )
      }))
    : []

  if (input.issueId !== undefined && input.issueId !== null
    && (!Number.isInteger(input.issueId) || input.issueId < 1)) {
    errors.issueId = ['Issue ID harus berupa angka positif.']
  }

  if (Object.keys(errors).length > 0) {
    throw new SampleDefectBatchValidationError(errors)
  }

  return {
    issueId: input.issueId ?? null,
    notificationNumber,
    modelName,
    serialNumber,
    cabang,
    parts
  }
}

export function createSampleDefectBatchService(config: SampleDefectBatchServiceConfig) {
  const clock = config.clock ?? (() => new Date())

  async function createBatch(
    input: CreateSampleDefectBatchInput,
    actorUserId: string
  ): Promise<CreateSampleDefectBatchResult> {
    const validInput = validateBatchInput(input)

    return config.db.transaction(async (transaction) => {
      const repository = createSampleDefectRepository({ db: transaction })
      const nowDate = clock()
      const now = nowDate.toISOString()
      const batchId = uuidv7()
      const items: SampleDefect[] = []

      for (const part of validInput.parts) {
        const sampleInput: CreateSampleDefectInput = {
          publicId: createPublicId('SD'),
          businessId: await createBusinessId(transaction, 'SD', nowDate),
          batchId,
          issueId: validInput.issueId,
          notificationNumber: validInput.notificationNumber,
          modelName: validInput.modelName,
          serialNumber: validInput.serialNumber,
          cabang: validInput.cabang,
          partNumber: part.partNumber,
          partName: part.partName,
          kerusakanCabang: part.kerusakanCabang,
          status: SAMPLE_DEFECT_STATUS.REQUESTED,
          createdAt: now,
          updatedAt: now,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId
        }
        const created = await repository.create(sampleInput)
        items.push(created)

        await recordAuditLog(transaction, {
          entityType: AUDIT_ENTITY_TYPE.SAMPLE_DEFECT,
          entityId: created.id,
          action: AUDIT_ACTION.CREATE,
          metadata: { batchId },
          actorUserId,
          createdAt: now
        })
      }

      return { batchId, items }
    })
  }

  return { createBatch }
}
