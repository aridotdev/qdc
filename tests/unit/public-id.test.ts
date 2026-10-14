import { describe, expect, it } from 'vitest'
import {
  createQualityIssueSchema,
  createSampleDefectBatchSchema,
  createTechnicalReportSchema,
  qualityIssuePublicIdSchema,
  sampleDefectPublicIdSchema,
  technicalReportPublicIdSchema,
  updateQualityIssueSchema
} from '#shared'
import { createPublicId } from '../../server/utils/public-id'

describe('public ID contracts', () => {
  it('generates distinct canonical UUIDv7 IDs for each entity', () => {
    const qualityIssueId = createPublicId('QI')
    const sampleDefectId = createPublicId('SD')
    const technicalReportId = createPublicId('TR')

    expect(qualityIssuePublicIdSchema.safeParse(qualityIssueId).success).toBe(true)
    expect(sampleDefectPublicIdSchema.safeParse(sampleDefectId).success).toBe(true)
    expect(technicalReportPublicIdSchema.safeParse(technicalReportId).success).toBe(true)
    expect(createPublicId('QI')).not.toBe(qualityIssueId)
  })

  it('rejects invalid UUID, casing, and entity prefix', () => {
    expect(qualityIssuePublicIdSchema.safeParse('QI-00000000-0000-7000-8000-000000000000').success)
      .toBe(true)
    expect(qualityIssuePublicIdSchema.safeParse('SD-00000000-0000-7000-8000-000000000000').success)
      .toBe(false)
    expect(qualityIssuePublicIdSchema.safeParse('QI-00000000-0000-4000-8000-000000000000').success)
      .toBe(false)
    expect(qualityIssuePublicIdSchema.safeParse('QI-00000000-0000-7000-8000-00000000000A').success)
      .toBe(false)
  })

  it('keeps public ID outside client create and update contracts', () => {
    const qualityIssuePayload = {
      issue_name: 'Housing retak',
      model_name: 'MODEL-01',
      serial_number: 'SN-001',
      tanggal_kejadian: '2026-10-03',
      detail: 'Retak pada housing.',
      public_id: createPublicId('QI')
    }
    const sampleDefectPayload = {
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
      ],
      public_id: createPublicId('SD')
    }
    const technicalReportPayload = {
      document_number: 'TR-001',
      document_type: 'TECHNICAL_REPORT',
      release_date: '2026-10-03',
      model_name: 'MODEL-01',
      issue_name: 'Housing retak',
      public_id: createPublicId('TR')
    }

    expect(createQualityIssueSchema.safeParse(qualityIssuePayload).success).toBe(false)
    expect(updateQualityIssueSchema.safeParse({ public_id: qualityIssuePayload.public_id }).success)
      .toBe(false)
    expect(createSampleDefectBatchSchema.safeParse(sampleDefectPayload).success).toBe(false)
    expect(createTechnicalReportSchema.safeParse(technicalReportPayload).success).toBe(false)
  })
})
