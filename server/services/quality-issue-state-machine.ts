import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  ERROR_CODES,
  QUALITY_ISSUE_STATUS,
  USER_ROLE,
  type QualityIssueStatus,
  type UserRole
} from '../../shared/constants'
import type { createDatabase } from '../database/client'
import type { QualityIssue } from '../database/schema'
import { createQualityIssueRepository } from '../repositories/quality-issues'
import { recordAuditLog } from './audit-logs'

type QualityIssueDatabase = Awaited<ReturnType<typeof createDatabase>>['db']
type QualityIssueStateAction = typeof AUDIT_ACTION.STATUS_CHANGE | typeof AUDIT_ACTION.ROLLBACK
type QualityIssueStatusResolver = (currentStatus: string) => QualityIssueStatus | undefined

const QUALITY_ISSUE_STATUS_ORDER: readonly QualityIssueStatus[] = [
  QUALITY_ISSUE_STATUS.OPEN,
  QUALITY_ISSUE_STATUS.IN_PROGRESS,
  QUALITY_ISSUE_STATUS.MONITORING,
  QUALITY_ISSUE_STATUS.CLOSED
]

export interface QualityIssueStateMachineConfig {
  db: QualityIssueDatabase
  clock?: () => Date
}

export interface QualityIssueStateActor {
  userId: string
  role: UserRole
}

export interface QualityIssueStateMutationContext {
  actor: QualityIssueStateActor
  reason?: string | null
}

export class QualityIssueNotFoundError extends Error {
  readonly code = ERROR_CODES.NOT_FOUND

  constructor(issueId: number) {
    super(`Quality Issue ${issueId} tidak ditemukan.`)
    this.name = 'QualityIssueNotFoundError'
  }
}

export class InvalidQualityIssueTransitionError extends Error {
  readonly code = ERROR_CODES.INVALID_TRANSITION
  readonly fromStatus: string
  readonly toStatus: string | null

  constructor(fromStatus: string, toStatus?: string) {
    const target = toStatus ? ` ke ${toStatus}` : ''
    super(`Transition Quality Issue dari ${fromStatus}${target} tidak valid.`)
    this.name = 'InvalidQualityIssueTransitionError'
    this.fromStatus = fromStatus
    this.toStatus = toStatus ?? null
  }
}

export class QualityIssueRollbackForbiddenError extends Error {
  readonly code = ERROR_CODES.FORBIDDEN

  constructor() {
    super('Rollback Quality Issue hanya dapat dilakukan oleh admin.')
    this.name = 'QualityIssueRollbackForbiddenError'
  }
}

export function getNextQualityIssueStatus(currentStatus: string): QualityIssueStatus | undefined {
  const currentIndex = QUALITY_ISSUE_STATUS_ORDER.indexOf(currentStatus as QualityIssueStatus)

  if (currentIndex < 0 || currentIndex === QUALITY_ISSUE_STATUS_ORDER.length - 1) {
    return undefined
  }

  return QUALITY_ISSUE_STATUS_ORDER[currentIndex + 1]
}

export function getPreviousQualityIssueStatus(
  currentStatus: string
): QualityIssueStatus | undefined {
  const currentIndex = QUALITY_ISSUE_STATUS_ORDER.indexOf(currentStatus as QualityIssueStatus)

  if (currentIndex <= 0) {
    return undefined
  }

  return QUALITY_ISSUE_STATUS_ORDER[currentIndex - 1]
}

function assertRollbackAccess(actor: QualityIssueStateActor): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new QualityIssueRollbackForbiddenError()
  }
}

export function createQualityIssueStateMachine(config: QualityIssueStateMachineConfig) {
  const clock = config.clock ?? (() => new Date())

  async function transition(
    issueId: number,
    resolveTargetStatus: QualityIssueStatusResolver,
    action: QualityIssueStateAction,
    context: QualityIssueStateMutationContext
  ): Promise<QualityIssue> {
    return config.db.transaction(async (transaction) => {
      const repository = createQualityIssueRepository({ db: transaction })
      const issue = await repository.findById(issueId)

      if (!issue) {
        throw new QualityIssueNotFoundError(issueId)
      }

      const targetStatus = resolveTargetStatus(issue.status)

      if (!targetStatus) {
        throw new InvalidQualityIssueTransitionError(issue.status)
      }

      const now = clock().toISOString()
      const updated = await repository.update(issueId, {
        status: targetStatus,
        updatedAt: now,
        updatedByUserId: context.actor.userId
      })

      if (!updated) {
        throw new QualityIssueNotFoundError(issueId)
      }

      await recordAuditLog(transaction, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
        entityId: issueId,
        action,
        fromStatus: issue.status,
        toStatus: targetStatus,
        metadata: context.reason ? { reason: context.reason } : null,
        actorUserId: context.actor.userId,
        createdAt: now
      })

      return updated
    })
  }

  async function forward(
    issueId: number,
    context: QualityIssueStateMutationContext
  ): Promise<QualityIssue> {
    return transition(
      issueId,
      getNextQualityIssueStatus,
      AUDIT_ACTION.STATUS_CHANGE,
      context
    )
  }

  async function rollback(
    issueId: number,
    context: QualityIssueStateMutationContext
  ): Promise<QualityIssue> {
    assertRollbackAccess(context.actor)

    return transition(
      issueId,
      getPreviousQualityIssueStatus,
      AUDIT_ACTION.ROLLBACK,
      context
    )
  }

  return {
    forward,
    rollback
  }
}
