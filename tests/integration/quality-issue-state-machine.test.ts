import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { AUDIT_ACTION, ERROR_CODES, QUALITY_ISSUE_STATUS, USER_ROLE } from '../../shared/constants'
import { createDatabase } from '../../server/database/client'
import { auditLogs, qualityIssues } from '../../server/database/schema'
import {
  createQualityIssueStateMachine,
  getNextQualityIssueStatus,
  getPreviousQualityIssueStatus,
  QualityIssueRollbackForbiddenError
} from '../../server/services/quality-issue-state-machine'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const now = new Date('2026-10-05T00:00:00.000Z')

describe('Quality Issue state machine service', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let stateMachine: ReturnType<typeof createQualityIssueStateMachine>
  let directory: string
  let sequence = 0

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-quality-issue-state-machine-'))
    database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
    stateMachine = createQualityIssueStateMachine({
      db: database.db,
      clock: () => now
    })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  async function createIssue(status = QUALITY_ISSUE_STATUS.OPEN) {
    sequence += 1
    const timestamp = now.toISOString()
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: `State issue ${sequence}`,
        modelName: 'MODEL-STATE',
        serialNumber: `SN-STATE-${sequence}`,
        tanggalKejadian: '2026-10-05',
        detail: 'State machine test issue',
        status,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdByUserId: 'creator-1',
        updatedByUserId: 'creator-1'
      })
      .returning()

    return issue!
  }

  const userActor = {
    userId: 'user-1',
    role: USER_ROLE.USER
  }
  const adminActor = {
    userId: 'admin-1',
    role: USER_ROLE.ADMIN
  }

  it('exposes only canonical next and previous states', () => {
    expect(getNextQualityIssueStatus(QUALITY_ISSUE_STATUS.OPEN)).toBe(
      QUALITY_ISSUE_STATUS.IN_PROGRESS
    )
    expect(getNextQualityIssueStatus(QUALITY_ISSUE_STATUS.IN_PROGRESS)).toBe(
      QUALITY_ISSUE_STATUS.MONITORING
    )
    expect(getNextQualityIssueStatus(QUALITY_ISSUE_STATUS.MONITORING)).toBe(
      QUALITY_ISSUE_STATUS.CLOSED
    )
    expect(getNextQualityIssueStatus(QUALITY_ISSUE_STATUS.CLOSED)).toBeUndefined()
    expect(getNextQualityIssueStatus('INVALID')).toBeUndefined()

    expect(getPreviousQualityIssueStatus(QUALITY_ISSUE_STATUS.CLOSED)).toBe(
      QUALITY_ISSUE_STATUS.MONITORING
    )
    expect(getPreviousQualityIssueStatus(QUALITY_ISSUE_STATUS.MONITORING)).toBe(
      QUALITY_ISSUE_STATUS.IN_PROGRESS
    )
    expect(getPreviousQualityIssueStatus(QUALITY_ISSUE_STATUS.IN_PROGRESS)).toBe(
      QUALITY_ISSUE_STATUS.OPEN
    )
    expect(getPreviousQualityIssueStatus(QUALITY_ISSUE_STATUS.OPEN)).toBeUndefined()
  })

  it('forwards through all canonical states and writes audit events atomically', async () => {
    const issue = await createIssue()

    await stateMachine.forward(issue.id, { actor: userActor })
    await stateMachine.forward(issue.id, { actor: userActor })
    const closed = await stateMachine.forward(issue.id, { actor: userActor })

    expect(closed.status).toBe(QUALITY_ISSUE_STATUS.CLOSED)
    expect(closed.updatedAt).toBe(now.toISOString())
    expect(closed.updatedByUserId).toBe(userActor.userId)

    const events = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, issue.id))

    expect(events).toHaveLength(3)
    expect(events.map(event => [event.action, event.fromStatus, event.toStatus])).toEqual([
      [AUDIT_ACTION.STATUS_CHANGE, QUALITY_ISSUE_STATUS.OPEN, QUALITY_ISSUE_STATUS.IN_PROGRESS],
      [
        AUDIT_ACTION.STATUS_CHANGE,
        QUALITY_ISSUE_STATUS.IN_PROGRESS,
        QUALITY_ISSUE_STATUS.MONITORING
      ],
      [AUDIT_ACTION.STATUS_CHANGE, QUALITY_ISSUE_STATUS.MONITORING, QUALITY_ISSUE_STATUS.CLOSED]
    ])
  })

  it('supports one-step admin rollback and records the optional reason', async () => {
    const issue = await createIssue(QUALITY_ISSUE_STATUS.MONITORING)
    const rolledBack = await stateMachine.rollback(issue.id, {
      actor: adminActor,
      reason: 'Perlu verifikasi ulang'
    })

    expect(rolledBack.status).toBe(QUALITY_ISSUE_STATUS.IN_PROGRESS)

    const [event] = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, issue.id))

    expect(event).toMatchObject({
      action: AUDIT_ACTION.ROLLBACK,
      fromStatus: QUALITY_ISSUE_STATUS.MONITORING,
      toStatus: QUALITY_ISSUE_STATUS.IN_PROGRESS,
      actorUserId: adminActor.userId
    })
    expect(JSON.parse(event?.metadataJson ?? '{}')).toEqual({
      reason: 'Perlu verifikasi ulang'
    })
  })

  it('rejects invalid transitions, rollback boundaries, and non-admin rollback', async () => {
    const closedIssue = await createIssue(QUALITY_ISSUE_STATUS.CLOSED)

    await expect(stateMachine.forward(closedIssue.id, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: QUALITY_ISSUE_STATUS.CLOSED
    })
    await expect(
      stateMachine.rollback(closedIssue.id, { actor: userActor })
    ).rejects.toBeInstanceOf(QualityIssueRollbackForbiddenError)

    const openIssue = await createIssue()
    await expect(stateMachine.rollback(openIssue.id, { actor: adminActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: QUALITY_ISSUE_STATUS.OPEN
    })

    const issueAfterRejectedRollback = await database.db
      .select({ status: qualityIssues.status })
      .from(qualityIssues)
      .where(eq(qualityIssues.id, openIssue.id))
    expect(issueAfterRejectedRollback[0]?.status).toBe(QUALITY_ISSUE_STATUS.OPEN)
  })

  it('rolls back the status when audit logging fails', async () => {
    const issue = await createIssue()

    await expect(
      stateMachine.forward(issue.id, {
        actor: {
          userId: '',
          role: USER_ROLE.USER
        }
      })
    ).rejects.toThrow()

    const [unchangedIssue] = await database.db
      .select({ status: qualityIssues.status })
      .from(qualityIssues)
      .where(eq(qualityIssues.id, issue.id))
    const events = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, issue.id))

    expect(unchangedIssue?.status).toBe(QUALITY_ISSUE_STATUS.OPEN)
    expect(events).toHaveLength(0)
  })
})
