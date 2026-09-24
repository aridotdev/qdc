import { ERROR_CODES, type ErrorCode } from '../constants'

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  [ERROR_CODES.BAD_REQUEST]: 400,
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.SESSION_EXPIRED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.INVALID_TRANSITION]: 409,
  [ERROR_CODES.DUPLICATE_DOCUMENT_NUMBER]: 409,
  [ERROR_CODES.INVALID_ATTACHMENT_OWNER]: 400,
  [ERROR_CODES.UNSUPPORTED_FILE_TYPE]: 400,
  [ERROR_CODES.FILE_TOO_LARGE]: 413,
  [ERROR_CODES.INTERNAL_ERROR]: 500
}

export type FieldErrors = Record<string, string[]>

export interface ApiErrorBody {
  code: ErrorCode
  message: string
  fieldErrors?: FieldErrors
}

export interface ApiErrorResponse {
  error: ApiErrorBody
}
