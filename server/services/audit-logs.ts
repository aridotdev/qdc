import type { AuditAction, AuditEntityType } from '../../shared/constants/domain'
import type { createDatabase } from '../database/client'
import { auditLogs, insertAuditLogSchema, type AuditLog } from '../database/schema'

type AuditLogDatabase = Pick<Awaited<ReturnType<typeof createDatabase>>['db'], 'insert'>

export interface RecordAuditLogInput {
  entityType: AuditEntityType
  entityId: number
  action: AuditAction
  fromStatus?: string | null
  toStatus?: string | null
  metadata?: Record<string, unknown> | null
  actorUserId: string
  createdAt: string
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  return metadata === undefined || metadata === null ? null : JSON.stringify(metadata)
}

/**
 * Menulis satu audit event. `db` dapat berupa database utama atau transaction
 * Drizzle, sehingga mutation domain dan event dapat di-commit secara atomic.
 */
export async function recordAuditLog(
  db: AuditLogDatabase,
  input: RecordAuditLogInput
): Promise<AuditLog> {
  const values = insertAuditLogSchema.parse({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    metadataJson: serializeMetadata(input.metadata),
    actorUserId: input.actorUserId,
    createdAt: input.createdAt
  })
  const [auditLog] = await db.insert(auditLogs).values(values).returning()

  if (!auditLog) {
    throw new Error('Audit log gagal dibuat.')
  }

  return auditLog
}
