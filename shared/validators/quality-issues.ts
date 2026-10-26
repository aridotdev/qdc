import { z } from 'zod'
import {
  businessDateSchema,
  isoDateTimeSchema,
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
  usage_period: optionalNullableText('Usage period'),
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
    usage_period: optionalNullableText('Usage period'),
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

export const qualityIssueProgressSchema = z.strictObject({
  tanggal: isoDateTimeSchema.optional(),
  action: requiredText('Action'),
  remark: optionalNullableText('Remark')
})

const qualityIssueProgressAttachmentIdsSchema = z.preprocess((value) => {
  if (value === undefined || value === '') {
    return []
  }

  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}, z.array(z.number().int().positive()).default([]))

export const qualityIssueProgressUpdateSchema = z.strictObject({
  action: requiredText('Action'),
  remark: z.string().trim().nullable().optional(),
  remove_attachment_ids: qualityIssueProgressAttachmentIdsSchema
})

export const qualityIssueStatusOperationSchema = z.strictObject({
  operation: z.enum(['FORWARD', 'ROLLBACK']),
  reason: optionalNullableText('Alasan')
})

export type CreateQualityIssuePayload = z.infer<typeof createQualityIssueSchema>
export type UpdateQualityIssuePayload = z.infer<typeof updateQualityIssueSchema>
export type QualityIssueFilter = z.infer<typeof qualityIssueFilterSchema>
export type QualityIssuePagination = z.infer<typeof qualityIssuePaginationSchema>
export type QualityIssueProgressPayload = z.infer<typeof qualityIssueProgressSchema>
export type QualityIssueProgressUpdatePayload = z.infer<typeof qualityIssueProgressUpdateSchema>
export type QualityIssueStatusOperationPayload = z.infer<
  typeof qualityIssueStatusOperationSchema
>
