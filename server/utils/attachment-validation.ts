import { ERROR_CODES } from '../../shared/constants'
import { attachmentPublicIdSchema } from '../../shared/validators/public-id'
import { createApiError } from './api-error'

export function parseAttachmentId(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'ID attachment tidak valid.'
    })
  }

  return Number(value)
}

export function parseAttachmentPublicId(value: string | undefined): string {
  const result = attachmentPublicIdSchema.safeParse(value)

  if (!result.success) {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Public ID attachment tidak valid.'
    })
  }

  return result.data
}
