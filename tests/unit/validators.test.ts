import { describe, expect, it } from 'vitest'
import {
  createQualityIssueSchema,
  createSampleDefectBatchSchema,
  createTechnicalReportSchema,
  formatValidationError,
  qualityIssuePaginationSchema,
  updateQualityIssueSchema
} from '#shared'

describe('Zod validation contracts', () => {
  it('accepts valid create payloads for all domains', () => {
    expect(
      createQualityIssueSchema.parse({
        issue_name: 'Housing retak',
        model_name: 'MODEL-01',
        serial_number: 'SN-001',
        tanggal_kejadian: '2026-10-03',
        detail: 'Retak pada housing.'
      })
    ).toMatchObject({
      issue_name: 'Housing retak'
    })

    expect(
      createSampleDefectBatchSchema.parse({
        notification_number: 'N-001',
        model_name: 'MODEL-01',
        serial_number: 'SN-001',
        cabang: 'Jakarta',
        parts: [
          {
            part_number: 'P-001',
            part_name: 'Housing',
            kerusakan_cabang: 'Retak'
          }
        ]
      }).parts
    ).toHaveLength(1)

    expect(
      createTechnicalReportSchema.parse({
        document_number: 'TR-001',
        document_type: 'TECHNICAL_REPORT',
        release_date: '2026-10-03',
        model_name: 'MODEL-01',
        issue_name: 'Housing retak'
      }).document_type
    ).toBe('TECHNICAL_REPORT')
  })

  it('rejects missing required fields and invalid canonical values', () => {
    const result = createTechnicalReportSchema.safeParse({
      document_number: 'TR-001',
      document_type: 'INVALID_TYPE',
      release_date: '2026-02-31',
      model_name: 'MODEL-01'
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatValidationError(result.error)
      expect(formatted).toHaveProperty('document_type')
      expect(formatted).toHaveProperty('release_date')
      expect(formatted).toHaveProperty('issue_name')
    }
  })

  it('rejects unknown fields and empty updates', () => {
    const unsafePayload = createQualityIssueSchema.safeParse({
      issue_name: 'Housing retak',
      model_name: 'MODEL-01',
      serial_number: 'SN-001',
      tanggal_kejadian: '2026-10-03',
      detail: 'Retak pada housing.',
      status: 'CLOSED'
    })
    const emptyUpdate = updateQualityIssueSchema.safeParse({})

    expect(unsafePayload.success).toBe(false)
    expect(emptyUpdate.success).toBe(false)
    if (!unsafePayload.success) {
      expect(formatValidationError(unsafePayload.error)).toHaveProperty('status')
    }
  })

  it('normalizes pagination defaults and query values', () => {
    expect(
      qualityIssuePaginationSchema.parse({
        page: '2',
        limit: '10',
        status: 'OPEN'
      })
    ).toMatchObject({
      page: 2,
      limit: 10,
      status: 'OPEN'
    })

    expect(qualityIssuePaginationSchema.parse({})).toMatchObject({
      page: 1,
      limit: 20
    })
  })
})
