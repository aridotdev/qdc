import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  type ApiErrorBody,
  type ErrorCode,
  type FieldErrors
} from '../../shared'
import { formatValidationError } from '../../shared/validators'
import type { ZodError } from 'zod'

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  500: 'Internal Server Error'
}

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.BAD_REQUEST]: 'Permintaan tidak valid.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Input tidak valid.',
  [ERROR_CODES.UNAUTHORIZED]: 'Session valid diperlukan.',
  [ERROR_CODES.SESSION_EXPIRED]: 'Session telah berakhir.',
  [ERROR_CODES.FORBIDDEN]: 'Akses ditolak.',
  [ERROR_CODES.NOT_FOUND]: 'Data tidak ditemukan.',
  [ERROR_CODES.CONFLICT]: 'Data bertentangan dengan kondisi saat ini.',
  [ERROR_CODES.INVALID_TRANSITION]: 'Perubahan status tidak valid.',
  [ERROR_CODES.DUPLICATE_DOCUMENT_NUMBER]: 'Nomor dokumen sudah digunakan.',
  [ERROR_CODES.INVALID_ATTACHMENT_OWNER]: 'Owner attachment tidak valid.',
  [ERROR_CODES.UNSUPPORTED_FILE_TYPE]: 'Tipe file tidak didukung.',
  [ERROR_CODES.FILE_TOO_LARGE]: 'Ukuran file terlalu besar.',
  [ERROR_CODES.INTERNAL_ERROR]: 'Terjadi kesalahan internal.'
}

interface ApiErrorInput {
  code: ErrorCode
  message?: string
  fieldErrors?: FieldErrors
  cause?: unknown
}

interface CodedError {
  code?: unknown
  message?: unknown
  data?: unknown
  status?: unknown
  statusCode?: unknown
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.values(ERROR_CODES).includes(value as ErrorCode)
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object') {
    return false
  }

  const body = value as Partial<ApiErrorBody>
  return isErrorCode(body.code) && typeof body.message === 'string'
}

function errorCodeFromStatus(status: unknown): ErrorCode | undefined {
  if (isErrorCode(status)) {
    return status
  }

  const statusCode = status

  if (statusCode === 400) {
    return ERROR_CODES.BAD_REQUEST
  }

  if (statusCode === 401) {
    return ERROR_CODES.UNAUTHORIZED
  }

  if (statusCode === 403) {
    return ERROR_CODES.FORBIDDEN
  }

  if (statusCode === 404) {
    return ERROR_CODES.NOT_FOUND
  }

  if (statusCode === 409) {
    return ERROR_CODES.CONFLICT
  }

  if (statusCode === 413) {
    return ERROR_CODES.FILE_TOO_LARGE
  }

  return undefined
}

function getApiErrorBody(error: unknown): ApiErrorBody | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const codedError = error as CodedError

  if (
    codedError.data
    && typeof codedError.data === 'object'
    && isApiErrorBody((codedError.data as { error?: unknown }).error)
  ) {
    return (codedError.data as { error: ApiErrorBody }).error
  }

  if (isErrorCode(codedError.code)) {
    return {
      code: codedError.code,
      message: typeof codedError.message === 'string'
        ? codedError.message
        : DEFAULT_MESSAGES[codedError.code]
    }
  }

  const statusCode = errorCodeFromStatus(codedError.statusCode ?? codedError.status)

  if (statusCode) {
    return {
      code: statusCode,
      message: DEFAULT_MESSAGES[statusCode]
    }
  }

  return undefined
}

export function createApiError(input: ApiErrorInput): ReturnType<typeof createError> {
  const message = input.message ?? DEFAULT_MESSAGES[input.code]
  const body: ApiErrorBody = {
    code: input.code,
    message,
    ...(input.fieldErrors ? { fieldErrors: input.fieldErrors } : {})
  }
  const statusCode = ERROR_HTTP_STATUS[input.code]

  return createError({
    statusCode,
    statusMessage: STATUS_MESSAGES[statusCode] ?? 'Error',
    message,
    data: { error: body },
    ...(input.cause ? { cause: input.cause } : {})
  })
}

export function createValidationError(error: ZodError): ReturnType<typeof createError> {
  return createApiError({
    code: ERROR_CODES.VALIDATION_ERROR,
    fieldErrors: formatValidationError(error)
  })
}

export function toApiError(error: unknown): ReturnType<typeof createError> {
  const body = getApiErrorBody(error)

  if (body) {
    return createApiError({
      code: body.code,
      message: body.message,
      fieldErrors: body.fieldErrors,
      cause: error
    })
  }

  return createApiError({
    code: ERROR_CODES.INTERNAL_ERROR,
    cause: error
  })
}

export function getApiErrorResponse(error: unknown): ApiErrorBody {
  const body = getApiErrorBody(error)

  if (body) {
    return body
  }

  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: DEFAULT_MESSAGES[ERROR_CODES.INTERNAL_ERROR]
  }
}
