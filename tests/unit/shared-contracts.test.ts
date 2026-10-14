import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_TYPE,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_DEFAULT_PAGE_SIZE,
  PAGINATION_MAX_PAGE_SIZE,
  QUALITY_ISSUE_STATUS,
  SAMPLE_DEFECT_STATUS
} from '#shared'
import type {
  CreateQualityIssueResponse,
  PaginatedResponse,
  QualityIssue,
  SampleDefect,
  TechnicalReport
} from '#shared'

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
    expect(PAGINATION_MAX_PAGE_SIZE).toBe(100)
  })

  it('supports typed paginated domain responses', () => {
    const response: PaginatedResponse<
      Pick<QualityIssue, 'id' | 'public_id' | 'business_id' | 'status'>
    > = {
      items: [{
        id: 1,
        public_id: 'QI-test',
        business_id: 'QI-20261014-001',
        status: QUALITY_ISSUE_STATUS.OPEN
      }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      }
    }

    expect(response.items[0]).toEqual({
      id: 1,
      public_id: 'QI-test',
      business_id: 'QI-20261014-001',
      status: 'OPEN'
    })
  })

  it('exposes public IDs in domain and create response types', () => {
    const sampleDefect: Pick<SampleDefect, 'id' | 'public_id' | 'business_id'> = {
      id: 1,
      public_id: 'SD-test',
      business_id: 'SD-20261014-001'
    }
    const technicalReport: Pick<TechnicalReport, 'id' | 'public_id' | 'business_id'> = {
      id: 1,
      public_id: 'TR-test',
      business_id: 'TR-20261014-001'
    }
    const createResponse: CreateQualityIssueResponse = {
      issueId: 1,
      publicId: 'QI-test',
      businessId: 'QI-20261014-001'
    }

    expect(sampleDefect.public_id).toBe('SD-test')
    expect(sampleDefect.business_id).toBe('SD-20261014-001')
    expect(technicalReport.public_id).toBe('TR-test')
    expect(technicalReport.business_id).toBe('TR-20261014-001')
    expect(createResponse).toEqual({
      issueId: 1,
      publicId: 'QI-test',
      businessId: 'QI-20261014-001'
    })
  })
})
