import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { QUALITY_ISSUE_STATUS, QUALITY_ISSUE_STATUSES } from '../../../shared/constants/domain'
import { auditFields } from './_audit-fields'
import { checkEnum } from './_check-enum'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { createPublicId } from '../../utils/public-id'

/**
 * db-schema.md §2 — Quality Issue
 * Parent dari `quality_issue_details`; direferensikan optional oleh
 * `sample_defects` dan `technical_reports`. Delete domain memakai soft delete.
 */
export const qualityIssues = sqliteTable(
  'quality_issues',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id')
      .notNull()
      .$defaultFn(() => createPublicId('QI')),
    businessId: text('business_id'),
    issueName: text('issue_name').notNull(),
    modelName: text('model_name').notNull(),
    serialNumber: text('serial_number').notNull(),
    // BusinessDate 'YYYY-MM-DD'
    tanggalKejadian: text('tanggal_kejadian').notNull(),
    usagePeriod: text('usage_period'),
    notificationNumber: text('notification_number'),
    detail: text('detail').notNull(),
    keterangan: text('keterangan'),
    status: text('status')
      .notNull()
      .default(QUALITY_ISSUE_STATUS.OPEN),
    deletedAt: text('deleted_at'),
    deletedByUserId: text('deleted_by_user_id'),
    deletionReason: text('deletion_reason'),
    ...auditFields
  },
  table => [
    uniqueIndex('quality_issues_public_id_unique').on(table.publicId),
    uniqueIndex('quality_issues_business_id_unique').on(table.businessId),
    index('quality_issues_status_idx').on(table.status),
    index('quality_issues_notification_number_idx').on(table.notificationNumber),
    index('quality_issues_model_name_idx').on(table.modelName),
    index('quality_issues_tanggal_kejadian_idx').on(table.tanggalKejadian),
    index('quality_issues_deleted_at_idx').on(table.deletedAt),
    check('quality_issues_status_check', checkEnum(table.status, QUALITY_ISSUE_STATUSES))
  ]
)

export const insertQualityIssueSchema = createInsertSchema(qualityIssues, {
  issueName: z.string().min(1, 'Issue name tidak boleh kosong').trim(),
  modelName: z.string().min(1, 'Model name tidak boleh kosong').trim(),
  serialNumber: z.string().min(1, 'Serial number tidak boleh kosong').trim(),
  tanggalKejadian: z.string().min(1, 'Tanggal tidak boleh kosong').trim(),
  usagePeriod: z.string().trim().nullable().optional(),
  notificationNumber: z.string().nullable().optional(),
  detail: z.string().min(1, 'Detail tidak boleh kosong').trim(),
  keterangan: z.string().nullable().optional(),
  status: z.enum(QUALITY_ISSUE_STATUSES).optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true,
  publicId: true,
  businessId: true,
  deletedAt: true,
  deletedByUserId: true,
  deletionReason: true
})

export const selectQualityIssueSchema = createSelectSchema(qualityIssues)

export const updateQualityIssueSchema = createUpdateSchema(qualityIssues, {
  issueName: z.string().min(1, 'Issue name tidak boleh kosong').trim().optional(),
  modelName: z.string().min(1, 'Model name tidak boleh kosong').trim().optional(),
  serialNumber: z.string().min(1, 'Serial number tidak boleh kosong').trim().optional(),
  tanggalKejadian: z.string().min(1, 'Tanggal tidak boleh kosong').trim().optional(),
  usagePeriod: z.string().trim().nullable().optional(),
  notificationNumber: z.string().nullable().optional(),
  detail: z.string().min(1, 'Detail tidak boleh kosong').trim().optional(),
  keterangan: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true,
  publicId: true,
  businessId: true,
  deletedAt: true,
  deletedByUserId: true,
  deletionReason: true
})

export type QualityIssue = typeof qualityIssues.$inferSelect
export type InsertQualityIssue = z.infer<typeof insertQualityIssueSchema>
export type UpdateQualityIssue = z.infer<typeof updateQualityIssueSchema>
