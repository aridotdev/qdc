import { z } from 'zod'
import {
  businessDateSchema,
  nonEmptyUpdateSchema,
  optionalNullableText,
  optionalText,
  paginationSchema,
  queryPositiveIdSchema,
  requiredText,
  documentTypeSchema
} from './common'

const technicalReportFilterShape = {
  document_number: optionalText('Nomor dokumen'),
  document_type: documentTypeSchema.optional(),
  model_name: optionalText('Model name'),
  issue_id: queryPositiveIdSchema.optional(),
  release_date_from: businessDateSchema.optional(),
  release_date_to: businessDateSchema.optional()
}

export const createTechnicalReportSchema = z.strictObject({
  issue_id: queryPositiveIdSchema.nullable().optional(),
  document_number: requiredText('Nomor dokumen'),
  document_type: documentTypeSchema,
  release_date: businessDateSchema,
  model_name: requiredText('Model name'),
  issue_name: requiredText('Nama issue'),
  root_cause: optionalNullableText('Root cause'),
  action: optionalNullableText('Action'),
  improvement_start_date: businessDateSchema.nullable().optional(),
  improvement_start_serial_number: optionalNullableText('Serial number improvement'),
  document_reference: optionalNullableText('Referensi dokumen'),
  keterangan: optionalNullableText('Keterangan')
})

export const updateTechnicalReportSchema = nonEmptyUpdateSchema(
  z.strictObject({
    issue_id: queryPositiveIdSchema.nullable().optional(),
    document_number: optionalText('Nomor dokumen'),
    document_type: documentTypeSchema.optional(),
    release_date: businessDateSchema.optional(),
    model_name: optionalText('Model name'),
    issue_name: optionalText('Nama issue'),
    root_cause: optionalNullableText('Root cause'),
    action: optionalNullableText('Action'),
    improvement_start_date: businessDateSchema.nullable().optional(),
    improvement_start_serial_number: optionalNullableText('Serial number improvement'),
    document_reference: optionalNullableText('Referensi dokumen'),
    keterangan: optionalNullableText('Keterangan')
  })
)

export const technicalReportFilterSchema = z.strictObject(technicalReportFilterShape)

export const technicalReportPaginationSchema = z.strictObject({
  ...paginationSchema.shape,
  ...technicalReportFilterShape
})

export const technicalReportListQuerySchema = technicalReportPaginationSchema

export type CreateTechnicalReportPayload = z.infer<typeof createTechnicalReportSchema>
export type UpdateTechnicalReportPayload = z.infer<typeof updateTechnicalReportSchema>
export type TechnicalReportFilter = z.infer<typeof technicalReportFilterSchema>
export type TechnicalReportPagination = z.infer<typeof technicalReportPaginationSchema>
