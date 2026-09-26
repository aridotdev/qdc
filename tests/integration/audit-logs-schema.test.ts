import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../../shared/constants/domain'
import { createDatabase } from '../../server/database/client'
import {
  auditLogs,
  insertAuditLogSchema,
  qualityIssues
} from '../../server/database/schema'
import {
  recordAuditLog,
  type RecordAuditLogInput
} from '../../server/services/audit-logs'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const now = '2026-09-26T00:00:00.000Z'

describe('Audit log schema and service', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let directory: string

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-audit-logs-'))
    database = await createDatabase(`file:${join(directory, 'test.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('creates the canonical table and indexes', async () => {
    const table = await database.client.execute({
      sql: 'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
      args: ['table', 'audit_logs']
    })
    const indexes = await database.client.execute({
      sql: 'SELECT name FROM sqlite_master WHERE type = ? AND name LIKE ? ORDER BY name',
      args: ['index', 'audit_logs_%']
    })

    expect(String(table.rows[0]?.sql)).toContain('entity_type')
    expect(String(table.rows[0]?.sql)).toContain('metadata_json')
    expect(indexes.rows).toEqual([
      { name: 'audit_logs_actor_user_id_idx' },
      { name: 'audit_logs_created_at_idx' },
      { name: 'audit_logs_entity_type_entity_id_created_at_idx' }
    ])
  })

  it('records create, update, delete, status change, rollback, and upload events', async () => {
    const actions = [
      AUDIT_ACTION.CREATE,
      AUDIT_ACTION.UPDATE,
      AUDIT_ACTION.DELETE,
      AUDIT_ACTION.STATUS_CHANGE,
      AUDIT_ACTION.ROLLBACK,
      AUDIT_ACTION.UPLOAD
    ]

    for (const action of actions) {
      await recordAuditLog(database.db, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
        entityId: 100,
        action,
        fromStatus: action === AUDIT_ACTION.STATUS_CHANGE ? 'OPEN' : null,
        toStatus: action === AUDIT_ACTION.STATUS_CHANGE ? 'IN_PROGRESS' : null,
        metadata: action === AUDIT_ACTION.UPDATE ? { changedFields: ['detail'] } : null,
        actorUserId: 'user-1',
        createdAt: now
      })
    }

    const events = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, 100))
      .orderBy(asc(auditLogs.id))

    expect(events.map(event => event.action)).toEqual(actions)
    expect(events[3]?.fromStatus).toBe('OPEN')
    expect(events[3]?.toStatus).toBe('IN_PROGRESS')
    expect(JSON.parse(events[1]?.metadataJson ?? '{}')).toEqual({
      changedFields: ['detail']
    })
    expect(events.every(event => event.actorUserId === 'user-1')).toBe(true)
  })

  it('validates audit event payload and canonical database values', async () => {
    const invalidPayload = insertAuditLogSchema.safeParse({
      entityType: 'INVALID_ENTITY',
      entityId: 1,
      action: 'INVALID_ACTION',
      actorUserId: 'user-1',
      createdAt: now
    })

    expect(invalidPayload.success).toBe(false)

    await expect(database.client.execute({
      sql: `INSERT INTO audit_logs
        (entity_type, entity_id, action, actor_user_id, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      args: ['QUALITY_ISSUE', 101, 'INVALID_ACTION', 'user-1', now]
    })).rejects.toThrow()
  })

  it('keeps audit logs append-only', async () => {
    const [event] = await database.db
      .insert(auditLogs)
      .values({
        entityType: AUDIT_ENTITY_TYPE.ATTACHMENT,
        entityId: 200,
        action: AUDIT_ACTION.UPLOAD,
        actorUserId: 'user-1',
        createdAt: now
      })
      .returning({ id: auditLogs.id })

    await expect(
      database.db
        .update(auditLogs)
        .set({ metadataJson: '{"changed":true}' })
        .where(eq(auditLogs.id, event!.id))
    ).rejects.toThrow()

    await expect(
      database.db.delete(auditLogs).where(eq(auditLogs.id, event!.id))
    ).rejects.toThrow()
  })

  it('commits status change and audit event in the same transaction', async () => {
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Atomic audit test',
        modelName: 'MODEL-AUDIT',
        serialNumber: 'SN-AUDIT',
        tanggalKejadian: '2026-09-26',
        detail: 'Issue untuk pengujian transaction audit.',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssues.id })

    await database.db.transaction(async (tx) => {
      await tx
        .update(qualityIssues)
        .set({ status: 'IN_PROGRESS', updatedAt: now, updatedByUserId: 'user-1' })
        .where(eq(qualityIssues.id, issue!.id))

      await recordAuditLog(tx, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
        entityId: issue!.id,
        action: AUDIT_ACTION.STATUS_CHANGE,
        fromStatus: 'OPEN',
        toStatus: 'IN_PROGRESS',
        actorUserId: 'user-1',
        createdAt: now
      })
    })

    const updatedIssue = await database.db
      .select({ status: qualityIssues.status })
      .from(qualityIssues)
      .where(eq(qualityIssues.id, issue!.id))
    const successfulEvents = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, issue!.id))

    expect(updatedIssue[0]?.status).toBe('IN_PROGRESS')
    expect(successfulEvents).toHaveLength(1)
    expect(successfulEvents[0]?.action).toBe(AUDIT_ACTION.STATUS_CHANGE)
  })

  it('records delete before removing the domain entity', async () => {
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Delete audit test',
        modelName: 'MODEL-AUDIT-DELETE',
        serialNumber: 'SN-AUDIT-DELETE',
        tanggalKejadian: '2026-09-26',
        detail: 'Issue untuk pengujian audit delete.',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssues.id })

    await database.db.transaction(async (tx) => {
      await recordAuditLog(tx, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
        entityId: issue!.id,
        action: AUDIT_ACTION.DELETE,
        actorUserId: 'admin-1',
        createdAt: now
      })
      await tx.delete(qualityIssues).where(eq(qualityIssues.id, issue!.id))
    })

    const deletedIssue = await database.db
      .select({ id: qualityIssues.id })
      .from(qualityIssues)
      .where(eq(qualityIssues.id, issue!.id))
    const deleteEvents = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, issue!.id))

    expect(deletedIssue).toEqual([])
    expect(deleteEvents).toHaveLength(1)
    expect(deleteEvents[0]?.action).toBe(AUDIT_ACTION.DELETE)
  })

  it('rolls back the domain update when the audit event fails', async () => {
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Rollback audit test',
        modelName: 'MODEL-AUDIT-ROLLBACK',
        serialNumber: 'SN-AUDIT-ROLLBACK',
        tanggalKejadian: '2026-09-26',
        detail: 'Issue untuk pengujian rollback transaction audit.',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssues.id })

    await expect(database.db.transaction(async (tx) => {
      await tx
        .update(qualityIssues)
        .set({ status: 'IN_PROGRESS', updatedAt: now, updatedByUserId: 'user-1' })
        .where(eq(qualityIssues.id, issue!.id))

      await recordAuditLog(tx, {
        entityType: AUDIT_ENTITY_TYPE.QUALITY_ISSUE,
        entityId: issue!.id,
        action: 'INVALID_ACTION' as RecordAuditLogInput['action'],
        actorUserId: 'user-1',
        createdAt: now
      })
    })).rejects.toThrow()

    const unchangedIssue = await database.db
      .select({ status: qualityIssues.status })
      .from(qualityIssues)
      .where(eq(qualityIssues.id, issue!.id))
    const failedEvents = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, issue!.id))

    expect(unchangedIssue[0]?.status).toBe('OPEN')
    expect(failedEvents).toEqual([])
  })
})
