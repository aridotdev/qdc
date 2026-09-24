import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_TYPE,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_DEFAULT_PAGE_SIZE,
  QUALITY_ISSUE_STATUS,
  SAMPLE_DEFECT_STATUS
} from '#shared'
import type { PaginatedResponse, QualityIssue } from '#shared'

describe('shared contracts', () => {
  it('exposes canonical domain status and document values', () => {
    expect(Object.values(QUALITY_ISSUE_STATUS)).toEqual([
      'OPEN',
      'IN_PROGRESS',
      'MONITORING',
      'CLOSED'
    ])
    expect(Object.values(SAMPLE_DEFECT_STATUS)).toEqual([
      'REQUESTED',
      'RECEIVED',
      'QRCC_VERIFIED',
      'HANDED_OVER_TO_PQA',
      'PQA_ANALYZED',
      'SUPPLIER_ANALYZED'
    ])
    expect(Object.values(DOCUMENT_TYPE)).toEqual(['TECHNICAL_REPORT', 'SERVICE_TIPS'])
  })

  it('keeps API error codes mapped to their HTTP status', () => {
    expect(ERROR_HTTP_STATUS[ERROR_CODES.VALIDATION_ERROR]).toBe(400)
    expect(ERROR_HTTP_STATUS[ERROR_CODES.UNAUTHORIZED]).toBe(401)
    expect(ERROR_HTTP_STATUS[ERROR_CODES.FORBIDDEN]).toBe(403)
    expect(ERROR_HTTP_STATUS[ERROR_CODES.NOT_FOUND]).toBe(404)
    expect(ERROR_HTTP_STATUS[ERROR_CODES.CONFLICT]).toBe(409)
    expect(ERROR_HTTP_STATUS[ERROR_CODES.INTERNAL_ERROR]).toBe(500)
  })

  it('defines the documented pagination defaults', () => {
    expect(PAGINATION_DEFAULT_PAGE).toBe(1)
    expect(PAGINATION_DEFAULT_PAGE_SIZE).toBe(20)
  })

  it('supports typed paginated domain responses', () => {
    const response: PaginatedResponse<Pick<QualityIssue, 'id' | 'status'>> = {
      items: [{ id: 1, status: QUALITY_ISSUE_STATUS.OPEN }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      }
    }

    expect(response.items[0]).toEqual({ id: 1, status: 'OPEN' })
  })
})
