import { ERROR_CODES } from '../../shared/constants'
import { positiveIdSchema } from '../../shared/validators/common'
import { qualityIssuePublicIdSchema } from '../../shared/validators/public-id'
import { createApiError } from './api-error'

export type QualityIssueIdentifier
  = { type: 'numeric', value: number }
    | { type: 'public', value: string }

export function parseQualityIssueIdentifier(value: string | undefined): QualityIssueIdentifier {
  if (value && /^[1-9]\d*$/.test(value)) {
    const numericId = positiveIdSchema.safeParse(Number(value))

    if (numericId.success) {
      return { type: 'numeric', value: numericId.data }
    }
  }

  const publicId = qualityIssuePublicIdSchema.safeParse(value)

  if (publicId.success) {
    return { type: 'public', value: publicId.data }
  }

  throw createApiError({
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'ID atau Public ID Quality Issue tidak valid.',
    fieldErrors: { id: ['ID atau Public ID Quality Issue tidak valid.'] }
  })
}

export function parseQualityIssueDetailId(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'ID detail Quality Issue tidak valid.'
    })
  }

  return Number(value)
}
