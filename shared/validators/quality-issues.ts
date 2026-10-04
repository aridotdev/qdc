import { z } from 'zod'
import {
  businessDateSchema,
  nonEmptyUpdateSchema,
  optionalNullableText,
  optionalText,
  paginationSchema,
  positiveIdSchema,
  qualityIssueStatusSchema,
  queryPositiveIdSchema,
  requiredText
} from './common'

const qualityIssueFilterShape = {
  status: qualityIssueStatusSchema.optional(),
  notification_number: optionalText('Nomor notifikasi'),
  model_name: optionalText('Model name'),
  tanggal_kejadian_from: businessDateSchema.optional(),
  tanggal_kejadian_to: businessDateSchema.optional()
}

export const createQualityIssueSchema = z.strictObject({
  issue_name: requiredText('Nama issue'),
  model_name: requiredText('Model name'),
  serial_number: requiredText('Serial number'),
  tanggal_kejadian: businessDateSchema,
  notification_number: optionalNullableText('Nomor notifikasi'),
  detail: requiredText('Detail'),
  keterangan: optionalNullableText('Keterangan')
})

export const updateQualityIssueSchema = nonEmptyUpdateSchema(
  z.strictObject({
    issue_name: optionalText('Nama issue'),
    model_name: optionalText('Model name'),
    serial_number: optionalText('Serial number'),
    tanggal_kejadian: businessDateSchema.optional(),
    notification_number: optionalNullableText('Nomor notifikasi'),
    detail: optionalText('Detail'),
    keterangan: optionalNullableText('Keterangan')
  })
)

export const qualityIssueFilterSchema = z.strictObject(qualityIssueFilterShape)

export const qualityIssuePaginationSchema = z.strictObject({
  ...paginationSchema.shape,
  ...qualityIssueFilterShape,
  issue_id: queryPositiveIdSchema.optional(),
  id: positiveIdSchema.optional()
})

export const qualityIssueListQuerySchema = qualityIssuePaginationSchema

export type CreateQualityIssuePayload = z.infer<typeof createQualityIssueSchema>
export type UpdateQualityIssuePayload = z.infer<typeof updateQualityIssueSchema>
export type QualityIssueFilter = z.infer<typeof qualityIssueFilterSchema>
export type QualityIssuePagination = z.infer<typeof qualityIssuePaginationSchema>
