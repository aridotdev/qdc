import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../../../shared/constants/domain'
import { checkEnum } from './_check-enum'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

const AUDIT_ACTIONS = Object.values(AUDIT_ACTION)
const AUDIT_ENTITY_TYPES = Object.values(AUDIT_ENTITY_TYPE)

/**
 * db-schema.md §7 — Audit Log.
 *
 * Audit log bersifat append-only dan tidak memakai `auditFields`: event hanya
 * memiliki actor serta waktu kejadian, tanpa kolom update yang dapat mengubah
 * histori.
 *
 * `entity_id` tidak memiliki FK karena `entity_type` menentukan tabel target
 * secara polymorphic. Log harus tetap dapat disimpan dan dibaca setelah entity
 * yang dicatat dihapus.
 */
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    action: text('action').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    metadataJson: text('metadata_json'),
    actorUserId: text('actor_user_id').notNull(),
    createdAt: text('created_at').notNull()
  },
  table => [
    index('audit_logs_entity_type_entity_id_created_at_idx').on(
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    index('audit_logs_actor_user_id_idx').on(table.actorUserId),
    index('audit_logs_created_at_idx').on(table.createdAt),
    check('audit_logs_entity_type_check', checkEnum(table.entityType, AUDIT_ENTITY_TYPES)),
    check('audit_logs_entity_id_check', sql`${table.entityId} > 0`),
    check('audit_logs_action_check', checkEnum(table.action, AUDIT_ACTIONS))
  ]
)

const metadataJsonSchema = z.string().refine((value) => {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}, 'Metadata harus berupa JSON valid')

export const insertAuditLogSchema = createInsertSchema(auditLogs, {
  entityType: z.enum(AUDIT_ENTITY_TYPES),
  entityId: z.number().int().positive(),
  action: z.enum(AUDIT_ACTIONS),
  fromStatus: z.string().nullable().optional(),
  toStatus: z.string().nullable().optional(),
  metadataJson: metadataJsonSchema.nullable().optional(),
  actorUserId: z.string().min(1, 'Actor user ID tidak boleh kosong').trim(),
  createdAt: z.string().datetime({ offset: true })
}).omit({
  id: true
})

export const selectAuditLogSchema = createSelectSchema(auditLogs)

export type AuditLog = typeof auditLogs.$inferSelect
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>
