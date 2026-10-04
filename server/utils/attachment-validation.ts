import { ERROR_CODES } from '../../shared/constants'
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
