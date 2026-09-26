import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { DOCUMENT_TYPES } from '../../../shared/constants/domain'
import { auditFields } from './_audit-fields'
import { checkEnum } from './_check-enum'
import { qualityIssues } from './quality-issues'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

/**
 * db-schema.md §5 — Technical Report.
 * `document_number` unik lintas seluruh tabel (bukan hanya per issue).
 */
export const technicalReports = sqliteTable(
  'technical_reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    issueId: integer('issue_id').references(() => qualityIssues.id, { onDelete: 'set null' }),
    documentNumber: text('document_number').notNull().unique(),
    documentType: text('document_type').notNull(),
    // BusinessDate 'YYYY-MM-DD'
    releaseDate: text('release_date').notNull(),
    modelName: text('model_name').notNull(),
    issueName: text('issue_name').notNull(),
    rootCause: text('root_cause'),
    action: text('action'),
    improvementStartDate: text('improvement_start_date'),
    improvementStartSerialNumber: text('improvement_start_serial_number'),
    documentReference: text('document_reference'),
    keterangan: text('keterangan'),
    ...auditFields
  },
  table => [
    index('technical_reports_issue_id_idx').on(table.issueId),
    index('technical_reports_document_type_idx').on(table.documentType),
    index('technical_reports_release_date_idx').on(table.releaseDate),
    index('technical_reports_model_name_idx').on(table.modelName),
    check(
      'technical_reports_document_type_check',
      checkEnum(table.documentType, DOCUMENT_TYPES)
    )
  ]
)

export const insertTechnicalReportSchema = createInsertSchema(technicalReports, {
  issueId: z.number().int().positive().nullable().optional(),
  documentNumber: z.string().min(1, 'Nomor dokumen tidak boleh kosong').trim(),
  documentType: z.enum(DOCUMENT_TYPES),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  modelName: z.string().min(1, 'Model name tidak boleh kosong').trim(),
  issueName: z.string().min(1, 'Issue name tidak boleh kosong').trim(),
  rootCause: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  improvementStartDate: z.string().nullable().optional(),
  improvementStartSerialNumber: z.string().nullable().optional(),
  documentReference: z.string().nullable().optional(),
  keterangan: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true
})

export const selectTechnicalReportSchema = createSelectSchema(technicalReports)

export const updateTechnicalReportSchema = createUpdateSchema(technicalReports, {
  issueId: z.number().int().positive().nullable().optional(),
  documentNumber: z.string().min(1, 'Nomor dokumen tidak boleh kosong').trim().optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  modelName: z.string().min(1, 'Model name tidak boleh kosong').trim().optional(),
  issueName: z.string().min(1, 'Issue name tidak boleh kosong').trim().optional(),
  rootCause: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  improvementStartDate: z.string().nullable().optional(),
  improvementStartSerialNumber: z.string().nullable().optional(),
  documentReference: z.string().nullable().optional(),
  keterangan: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true
})

export type TechnicalReport = typeof technicalReports.$inferSelect
export type InsertTechnicalReport = z.infer<typeof insertTechnicalReportSchema>
export type UpdateTechnicalReport = z.infer<typeof updateTechnicalReportSchema>
