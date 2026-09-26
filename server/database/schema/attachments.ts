import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { ATTACHMENT_MIME_TYPES } from '../../../shared/constants/domain'
import { auditFields } from './_audit-fields'
import { checkEnum } from './_check-enum'
import { qualityIssueDetails } from './quality-issue-details'
import { sampleDefects } from './sample-defects'
import { technicalReports } from './technical-reports'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

/**
 * db-schema.md §6 — Attachment.
 *
 * Owner bersifat polymorphic melalui tiga FK nullable (`detail_id`,
 * `sample_id`, `report_id`). Invariant "tepat satu owner" ditegakkan di
 * database lewat CHECK constraint di bawah, selain juga wajib ditegakkan
 * di service layer (lihat db-schema.md §6 dan §8).
 */
export const attachments = sqliteTable(
  'attachments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    detailId: integer('detail_id').references(() => qualityIssueDetails.id, {
      onDelete: 'cascade'
    }),
    sampleId: integer('sample_id').references(() => sampleDefects.id, { onDelete: 'cascade' }),
    reportId: integer('report_id').references(() => technicalReports.id, {
      onDelete: 'cascade'
    }),
    fileName: text('file_name').notNull(),
    storageName: text('storage_name').notNull().unique(),
    fileUrl: text('file_url').notNull(),
    fileType: text('file_type').notNull(),
    fileSize: integer('file_size').notNull(),
    ...auditFields
  },
  table => [
    index('attachments_detail_id_idx').on(table.detailId),
    index('attachments_sample_id_idx').on(table.sampleId),
    index('attachments_report_id_idx').on(table.reportId),
    index('attachments_file_type_idx').on(table.fileType),
    check('attachments_file_type_check', checkEnum(table.fileType, ATTACHMENT_MIME_TYPES)),
    check('attachments_file_size_check', sql`${table.fileSize} >= 0`),
    check(
      'attachments_single_owner_check',
      sql`(
        (case when ${table.detailId} is not null then 1 else 0 end) +
        (case when ${table.sampleId} is not null then 1 else 0 end) +
        (case when ${table.reportId} is not null then 1 else 0 end)
      ) = 1`
    )
  ]
)

export const insertAttachmentSchema = createInsertSchema(attachments, {
  detailId: z.number().int().positive().nullable().optional(),
  sampleId: z.number().int().positive().nullable().optional(),
  reportId: z.number().int().positive().nullable().optional(),
  fileName: z.string().min(1, 'Nama file tidak boleh kosong').trim(),
  storageName: z.string().min(1, 'Storage name tidak boleh kosong').trim(),
  fileUrl: z.string().min(1, 'File URL tidak boleh kosong').trim(),
  fileType: z.enum(ATTACHMENT_MIME_TYPES),
  fileSize: z.number().int().nonnegative()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true
}).superRefine((value, context) => {
  const ownerCount = [value.detailId, value.sampleId, value.reportId]
    .filter(ownerId => ownerId !== null && ownerId !== undefined)
    .length

  if (ownerCount !== 1) {
    context.addIssue({
      code: 'custom',
      path: ['detailId'],
      message: 'Attachment harus memiliki tepat satu owner'
    })
  }
})

export const selectAttachmentSchema = createSelectSchema(attachments)

export const updateAttachmentSchema = createUpdateSchema(attachments, {
  detailId: z.number().int().positive().nullable().optional(),
  sampleId: z.number().int().positive().nullable().optional(),
  reportId: z.number().int().positive().nullable().optional(),
  fileName: z.string().min(1, 'Nama file tidak boleh kosong').trim().optional(),
  storageName: z.string().min(1, 'Storage name tidak boleh kosong').trim().optional(),
  fileUrl: z.string().min(1, 'File URL tidak boleh kosong').trim().optional(),
  fileType: z.enum(ATTACHMENT_MIME_TYPES).optional(),
  fileSize: z.number().int().nonnegative().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true
})

export type Attachment = typeof attachments.$inferSelect
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>
export type UpdateAttachment = z.infer<typeof updateAttachmentSchema>
