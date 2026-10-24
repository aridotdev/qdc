import { and, eq } from 'drizzle-orm'
import {
  ERROR_CODES,
  QUALITY_ISSUE_DETAIL_ACTION
} from '../../../../shared/constants'
import { qualityIssueDetails, qualityIssues } from '../../../database/schema'
import db from '../../../database'
import { uploadAttachment } from '../../../utils/attachment-api'
import { createApiError } from '../../../utils/api-error'
import { resolveQualityIssueId } from '../../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const issueId = await resolveQualityIssueId(getRouterParam(event, 'id'))
  const [initialEvidence] = await db
    .select({
      id: qualityIssueDetails.id,
      businessId: qualityIssues.businessId,
      createdAt: qualityIssues.createdAt
    })
    .from(qualityIssueDetails)
    .innerJoin(qualityIssues, eq(qualityIssues.id, qualityIssueDetails.issueId))
    .where(and(
      eq(qualityIssueDetails.issueId, issueId),
      eq(qualityIssueDetails.action, QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE)
    ))
    .limit(1)

  if (!initialEvidence) {
    throw createApiError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Quality Issue tidak ditemukan atau belum memiliki detail awal.'
    })
  }

  return uploadAttachment(event, {
    field: 'detailId',
    id: initialEvidence.id,
    getStorageContext: async () => {
      if (!initialEvidence.businessId) {
        return undefined
      }

      return {
        section: 'quality-issue' as const,
        reportYear: new Date(initialEvidence.createdAt).getUTCFullYear(),
        businessId: initialEvidence.businessId
      }
    }
  })
})
