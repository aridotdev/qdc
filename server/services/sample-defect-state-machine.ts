import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  ERROR_CODES,
  SAMPLE_CONDITIONS,
  SAMPLE_DEFECT_STATUS,
  USER_ROLE,
  type SampleCondition,
  type SampleDefectStatus,
  type UserRole
} from '../../shared/constants'
import type { FieldErrors } from '../../shared/errors'
import type { createDatabase } from '../database/client'
import type { SampleDefect } from '../database/schema'
import {
  createSampleDefectRepository,
  type UpdateSampleDefectInput,
  type SampleDefectStatusUpdate
} from '../repositories/sample-defects'
import { recordAuditLog } from './audit-logs'

type SampleDefectDatabase = Awaited<ReturnType<typeof createDatabase>>['db']
type SampleDefectStateAction = typeof AUDIT_ACTION.STATUS_CHANGE | typeof AUDIT_ACTION.ROLLBACK
type SampleDefectStatusResolver = (currentStatus: string) => SampleDefectStatus | undefined
export type SampleDefectOperation = 'RECEIVE' | 'VERIFY' | 'HANDOVER' | 'PQA_ANALYSIS' | 'SUPPLIER_ANALYSIS'

const SAMPLE_DEFECT_STATUS_ORDER: readonly SampleDefectStatus[] = [
  SAMPLE_DEFECT_STATUS.REQUESTED,
  SAMPLE_DEFECT_STATUS.RECEIVED,
  SAMPLE_DEFECT_STATUS.QRCC_VERIFIED,
  SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA,
  SAMPLE_DEFECT_STATUS.PQA_ANALYZED,
  SAMPLE_DEFECT_STATUS.SUPPLIER_ANALYZED
]

const SAMPLE_DEFECT_OPERATION_SOURCE: Record<SampleDefectOperation, SampleDefectStatus> = {
  RECEIVE: SAMPLE_DEFECT_STATUS.REQUESTED,
  VERIFY: SAMPLE_DEFECT_STATUS.RECEIVED,
  HANDOVER: SAMPLE_DEFECT_STATUS.QRCC_VERIFIED,
  PQA_ANALYSIS: SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA,
  SUPPLIER_ANALYSIS: SAMPLE_DEFECT_STATUS.PQA_ANALYZED
}

export interface SampleDefectStateMachineConfig {
  db: SampleDefectDatabase
  clock?: () => Date
}

export interface SampleDefectStateActor {
  userId: string
  role: UserRole
}

export interface SampleDefectStateMutationContext {
  actor: SampleDefectStateActor
  reason?: string | null
  expectedUpdatedAt?: string
}

export interface ReceiveSampleDefectInput {
  tanggalTerima: string
  keteranganTerima?: string | null
}

export interface VerifySampleDefectInput {
  kerusakanVerifikasi: string
}

export interface HandoverSampleDefectInput {
  namaPenerimaPqa: string
  tanggalSerahPqa: string
}

export interface PqaAnalysisSampleDefectInput {
  kondisiPqa: SampleCondition
  repair: string
}

export interface SupplierAnalysisSampleDefectInput {
  hasilAnalisaSupplier: string
}

export class SampleDefectNotFoundError extends Error {
  readonly code = ERROR_CODES.NOT_FOUND

  constructor(sampleId: number) {
    super(`Sample Defect ${sampleId} tidak ditemukan.`)
    this.name = 'SampleDefectNotFoundError'
  }
}

export class InvalidSampleDefectTransitionError extends Error {
  readonly code = ERROR_CODES.INVALID_TRANSITION
  readonly fromStatus: string
  readonly toStatus: string | null

  constructor(fromStatus: string, toStatus?: string) {
    const target = toStatus ? ` ke ${toStatus}` : ''
    super(`Transition Sample Defect dari ${fromStatus}${target} tidak valid.`)
    this.name = 'InvalidSampleDefectTransitionError'
    this.fromStatus = fromStatus
    this.toStatus = toStatus ?? null
  }
}

export class SampleDefectRollbackForbiddenError extends Error {
  readonly code = ERROR_CODES.FORBIDDEN

  constructor() {
    super('Rollback Sample Defect hanya dapat dilakukan oleh admin.')
    this.name = 'SampleDefectRollbackForbiddenError'
  }
}

export class SampleDefectRequiredFieldError extends Error {
  readonly code = ERROR_CODES.VALIDATION_ERROR
  readonly field: string
  readonly operation: SampleDefectOperation
  readonly fieldErrors: FieldErrors

  constructor(operation: SampleDefectOperation, field: string) {
    super(`Field ${field} wajib diisi untuk operasi ${operation}.`)
    this.name = 'SampleDefectRequiredFieldError'
    this.field = field
    this.operation = operation
    this.fieldErrors = { [field]: [this.message] }
  }
}

export class SampleDefectConcurrencyConflictError extends Error {
  readonly code = ERROR_CODES.CONFLICT

  constructor(sampleId: number) {
    super(`Sample Defect ${sampleId} sudah berubah. Muat ulang data sebelum mencoba lagi.`)
    this.name = 'SampleDefectConcurrencyConflictError'
  }
}

export function getNextSampleDefectStatus(currentStatus: string): SampleDefectStatus | undefined {
  const currentIndex = SAMPLE_DEFECT_STATUS_ORDER.indexOf(currentStatus as SampleDefectStatus)

  if (currentIndex < 0 || currentIndex === SAMPLE_DEFECT_STATUS_ORDER.length - 1) {
    return undefined
  }

  return SAMPLE_DEFECT_STATUS_ORDER[currentIndex + 1]
}

export function getPreviousSampleDefectStatus(currentStatus: string): SampleDefectStatus | undefined {
  const currentIndex = SAMPLE_DEFECT_STATUS_ORDER.indexOf(currentStatus as SampleDefectStatus)

  if (currentIndex <= 0) {
    return undefined
  }

  return SAMPLE_DEFECT_STATUS_ORDER[currentIndex - 1]
}

function assertRollbackAccess(actor: SampleDefectStateActor): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new SampleDefectRollbackForbiddenError()
  }
}

function requireText(
  operation: SampleDefectOperation,
  field: string,
  value: string | null | undefined
): string {
  if (!value || value.trim().length === 0) {
    throw new SampleDefectRequiredFieldError(operation, field)
  }

  return value.trim()
}

function requireCondition(value: SampleCondition | null | undefined): SampleCondition {
  if (!value || !SAMPLE_CONDITIONS.includes(value)) {
    throw new SampleDefectRequiredFieldError('PQA_ANALYSIS', 'kondisiPqa')
  }

  return value
}

export function createSampleDefectStateMachine(config: SampleDefectStateMachineConfig) {
  const clock = config.clock ?? (() => new Date())

  async function transition(
    sampleId: number,
    resolveTargetStatus: SampleDefectStatusResolver,
    action: SampleDefectStateAction,
    operation: SampleDefectOperation | 'ROLLBACK',
    fields: Partial<SampleDefectStatusUpdate>,
    context: SampleDefectStateMutationContext
  ): Promise<SampleDefect> {
    return config.db.transaction(async (transaction) => {
      const repository = createSampleDefectRepository({ db: transaction })
      const sample = await repository.findById(sampleId)

      if (!sample) {
        throw new SampleDefectNotFoundError(sampleId)
      }

      if (context.expectedUpdatedAt && context.expectedUpdatedAt !== sample.updatedAt) {
        throw new SampleDefectConcurrencyConflictError(sampleId)
      }

      const targetStatus = resolveTargetStatus(sample.status)

      if (!targetStatus) {
        throw new InvalidSampleDefectTransitionError(sample.status)
      }

      const sourceStatus = operation === 'ROLLBACK'
        ? undefined
        : SAMPLE_DEFECT_OPERATION_SOURCE[operation]

      if (sourceStatus && sample.status !== sourceStatus) {
        throw new InvalidSampleDefectTransitionError(sample.status, targetStatus)
      }

      const now = clock().toISOString()
      const updated = await repository.updateStatus(sampleId, sample.status, sample.updatedAt, {
        ...fields,
        status: targetStatus,
        updatedAt: now,
        updatedByUserId: context.actor.userId
      })

      if (!updated) {
        const current = await repository.findById(sampleId)

        if (!current) {
          throw new SampleDefectNotFoundError(sampleId)
        }

        throw new SampleDefectConcurrencyConflictError(sampleId)
      }

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.SAMPLE_DEFECT,
        entityId: sampleId,
        action,
        fromStatus: sample.status,
        toStatus: targetStatus,
        metadata: {
          operation,
          ...(context.reason ? { reason: context.reason } : {})
        },
        actorUserId: context.actor.userId,
        createdAt: now
      })

      return updated
    })
  }

  async function receive(
    sampleId: number,
    input: ReceiveSampleDefectInput,
    context: SampleDefectStateMutationContext
  ): Promise<SampleDefect> {
    return transition(
      sampleId,
      getNextSampleDefectStatus,
      AUDIT_ACTION.STATUS_CHANGE,
      'RECEIVE',
      {
        tanggalTerima: requireText('RECEIVE', 'tanggalTerima', input.tanggalTerima),
        keteranganTerima: input.keteranganTerima ?? null
      },
      context
    )
  }

  async function update(
    sampleId: number,
    input: UpdateSampleDefectInput,
    context: SampleDefectStateMutationContext
  ): Promise<SampleDefect> {
    return config.db.transaction(async (transaction) => {
      const repository = createSampleDefectRepository({ db: transaction })
      const sample = await repository.findById(sampleId)

      if (!sample) {
        throw new SampleDefectNotFoundError(sampleId)
      }

      if (context.expectedUpdatedAt && context.expectedUpdatedAt !== sample.updatedAt) {
        throw new SampleDefectConcurrencyConflictError(sampleId)
      }

      const changes = Object.fromEntries(
        Object.entries(input).filter(([key, value]) => key !== 'status' && value !== undefined)
      ) as UpdateSampleDefectInput
      const now = clock().toISOString()
      const updated = await repository.update(sampleId, {
        ...changes,
        updatedAt: now,
        updatedByUserId: context.actor.userId
      })

      if (!updated) {
        throw new SampleDefectConcurrencyConflictError(sampleId)
      }

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.SAMPLE_DEFECT,
        entityId: sampleId,
        action: AUDIT_ACTION.UPDATE,
        metadata: { fields: Object.keys(changes) },
        actorUserId: context.actor.userId,
        createdAt: now
      })

      return updated
    })
  }

  async function verify(
    sampleId: number,
    input: VerifySampleDefectInput,
    context: SampleDefectStateMutationContext
  ): Promise<SampleDefect> {
    return transition(
      sampleId,
      getNextSampleDefectStatus,
      AUDIT_ACTION.STATUS_CHANGE,
      'VERIFY',
      { kerusakanVerifikasi: requireText('VERIFY', 'kerusakanVerifikasi', input.kerusakanVerifikasi) },
      context
    )
  }

  async function handover(
    sampleId: number,
    input: HandoverSampleDefectInput,
    context: SampleDefectStateMutationContext
  ): Promise<SampleDefect> {
    return transition(
      sampleId,
      getNextSampleDefectStatus,
      AUDIT_ACTION.STATUS_CHANGE,
      'HANDOVER',
      {
        namaPenerimaPqa: requireText('HANDOVER', 'namaPenerimaPqa', input.namaPenerimaPqa),
        tanggalSerahPqa: requireText('HANDOVER', 'tanggalSerahPqa', input.tanggalSerahPqa)
      },
      context
    )
  }

  async function pqaAnalysis(
    sampleId: number,
    input: PqaAnalysisSampleDefectInput,
    context: SampleDefectStateMutationContext
  ): Promise<SampleDefect> {
    return transition(
      sampleId,
      getNextSampleDefectStatus,
      AUDIT_ACTION.STATUS_CHANGE,
      'PQA_ANALYSIS',
      {
        kondisiPqa: requireCondition(input.kondisiPqa),
        repair: requireText('PQA_ANALYSIS', 'repair', input.repair)
      },
      context
    )
  }

  async function supplierAnalysis(
    sampleId: number,
    input: SupplierAnalysisSampleDefectInput,
    context: SampleDefectStateMutationContext
  ): Promise<SampleDefect> {
    return transition(
      sampleId,
      getNextSampleDefectStatus,
      AUDIT_ACTION.STATUS_CHANGE,
      'SUPPLIER_ANALYSIS',
      {
        hasilAnalisaSupplier: requireText(
          'SUPPLIER_ANALYSIS',
          'hasilAnalisaSupplier',
          input.hasilAnalisaSupplier
        )
      },
      context
    )
  }

  async function rollback(
    sampleId: number,
    context: SampleDefectStateMutationContext
  ): Promise<SampleDefect> {
    assertRollbackAccess(context.actor)

    return transition(
      sampleId,
      getPreviousSampleDefectStatus,
      AUDIT_ACTION.ROLLBACK,
      'ROLLBACK',
      {},
      context
    )
  }

  return {
    update,
    receive,
    verify,
    handover,
    pqaAnalysis,
    supplierAnalysis,
    rollback,
    getNextStatus: getNextSampleDefectStatus,
    getPreviousStatus: getPreviousSampleDefectStatus
  }
}
