import {
  DOCUMENT_TYPES,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_DEFAULT_PAGE_SIZE,
  PAGINATION_MAX_PAGE_SIZE,
  QUALITY_ISSUE_STATUSES,
  SAMPLE_CONDITIONS,
  SAMPLE_DEFECT_STATUSES,
  SORT_DIRECTION
} from '../constants'
import type { FieldErrors } from '../errors'
import { z } from 'zod'

export const qualityIssueStatusSchema = z.enum(QUALITY_ISSUE_STATUSES)
export const sampleDefectStatusSchema = z.enum(SAMPLE_DEFECT_STATUSES)
export const documentTypeSchema = z.enum(DOCUMENT_TYPES)
export const sampleConditionSchema = z.enum(SAMPLE_CONDITIONS)

export const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_MAX_PAGE_SIZE)
    .default(PAGINATION_DEFAULT_PAGE_SIZE),
  search: z.string().trim().min(1).optional(),
  sortBy: z.string().trim().min(1).optional(),
  sortDirection: z.enum(Object.values(SORT_DIRECTION)).optional()
})

export const positiveIdSchema = z.number().int().positive()
export const queryPositiveIdSchema = z.coerce.number().int().positive()

export const businessDateSchema = z.iso.date({
  error: 'Tanggal harus berformat YYYY-MM-DD.'
})

export const isoDateTimeSchema = z.iso.datetime({
  offset: true,
  error: 'Tanggal harus berupa ISO 8601 yang valid.'
})

export function requiredText(label: string): z.ZodString {
  return z.string().trim().min(1, `${label} tidak boleh kosong.`)
}

export function optionalText(label: string): z.ZodOptional<z.ZodString> {
  return requiredText(label).optional()
}

export function optionalNullableText(label: string): z.ZodOptional<z.ZodNullable<z.ZodString>> {
  return requiredText(label).nullable().optional()
}

export function nonEmptyUpdateSchema<T extends z.ZodObject>(shape: T): T {
  return shape.refine(value => Object.keys(value).length > 0, {
    message: 'Minimal satu field harus diisi untuk update.'
  }) as T
}

export function formatValidationError(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {}

  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        fieldErrors[key] ??= []
        fieldErrors[key].push(`Field tidak dikenali: ${key}.`)
      }
      continue
    }

    if (issue.path.length === 0) {
      fieldErrors._form ??= []
      fieldErrors._form.push(issue.message)
      continue
    }

    const field = issue.path.map(String).join('.')
    fieldErrors[field] ??= []
    fieldErrors[field].push(issue.message)
  }

  return fieldErrors
}
