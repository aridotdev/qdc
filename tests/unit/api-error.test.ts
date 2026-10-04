import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ERROR_CODES } from '#shared'
import {
  createApiError,
  createValidationError,
  getApiErrorResponse,
  toApiError
} from '../../server/utils/api-error'

describe('API error convention', () => {
  const originalCreateError = globalThis.createError

  beforeAll(() => {
    globalThis.createError = ((input: {
      statusCode: number
      statusMessage: string
      message: string
      data?: unknown
      cause?: unknown
    }) => Object.assign(new Error(input.message), input)) as typeof globalThis.createError
  })

  afterAll(() => {
    globalThis.createError = originalCreateError
  })

  it.each([
    [ERROR_CODES.VALIDATION_ERROR, 400],
    [ERROR_CODES.UNAUTHORIZED, 401],
    [ERROR_CODES.FORBIDDEN, 403],
    [ERROR_CODES.NOT_FOUND, 404],
    [ERROR_CODES.CONFLICT, 409],
    [ERROR_CODES.INTERNAL_ERROR, 500]
  ] as const)('maps %s to HTTP %s', (code, statusCode) => {
    expect(createApiError({ code }).statusCode).toBe(statusCode)
  })

  it('formats Zod issues as field-level validation errors', () => {
    const result = z.object({
      name: z.string().min(1),
      status: z.enum(['OPEN'])
    }).safeParse({
      name: '',
      status: 'INVALID'
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const error = createValidationError(result.error)

      expect(error.statusCode).toBe(400)
      expect(error.data).toEqual({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Input tidak valid.',
          fieldErrors: expect.objectContaining({
            name: expect.any(Array),
            status: expect.any(Array)
          })
        }
      })
    }
  })

  it('hides internal error details and preserves standard status codes', () => {
    const internal = toApiError(new Error('/home/arsya/sharp/qdc/.env secret stack'))
    const notFound = getApiErrorResponse({ statusCode: 404, message: 'private path' })
    const unauthorized = getApiErrorResponse({ status: 'UNAUTHORIZED' })

    expect(internal.statusCode).toBe(500)
    expect(internal.data).toEqual({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Terjadi kesalahan internal.'
      }
    })
    expect(JSON.stringify(internal.data)).not.toContain('/home/arsya')
    expect(notFound).toEqual({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Data tidak ditemukan.'
    })
    expect(unauthorized).toEqual({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Session valid diperlukan.'
    })
  })
})
