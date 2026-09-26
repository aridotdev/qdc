import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { auditFields } from './_audit-fields'
import { qualityIssues } from './quality-issues'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

/**
 * db-schema.md §3 — Quality Issue Detail (timeline entries).
 *
 * Entry pertama dibuat otomatis saat Quality Issue dibuat, memakai
 * action = 'INITIAL_EVIDENCE' (lihat QUALITY_ISSUE_DETAIL_ACTION di
 * constants.ts), untuk menampung attachment awal.
 */
export const qualityIssueDetails = sqliteTable(
  'quality_issue_details',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    issueId: integer('issue_id')
      .notNull()
      .references(() => qualityIssues.id, { onDelete: 'cascade' }),
    // Timestamp progress (ISO 8601 UTC string)
    tanggal: text('tanggal').notNull(),
    action: text('action').notNull(),
    remark: text('remark'),
    ...auditFields
  },
  table => [
    index('quality_issue_details_issue_id_tanggal_idx').on(table.issueId, table.tanggal),
    index('quality_issue_details_tanggal_idx').on(table.tanggal)
  ]
)

export const insertQualityIssueDetailSchema = createInsertSchema(qualityIssueDetails, {
  issueId: z.number().int().positive(),
  tanggal: z.string().min(1, 'Tanggal tidak boleh kosong').trim(),
  action: z.string().min(1, 'Action tidak boleh kosong').trim(),
  remark: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true
})

export const selectQualityIssueDetailSchema = createSelectSchema(qualityIssueDetails)

export const updateQualityIssueDetailSchema = createUpdateSchema(qualityIssueDetails, {
  issueId: z.number().int().positive().optional(),
  tanggal: z.string().min(1, 'Tanggal tidak boleh kosong').trim().optional(),
  action: z.string().min(1, 'Action tidak boleh kosong').trim().optional(),
  remark: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true
})

export type QualityIssueDetail = typeof qualityIssueDetails.$inferSelect
export type InsertQualityIssueDetail = z.infer<typeof insertQualityIssueDetailSchema>
export type UpdateQualityIssueDetail = z.infer<typeof updateQualityIssueDetailSchema>
