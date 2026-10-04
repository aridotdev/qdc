import { and, eq } from 'drizzle-orm'
import {
  ERROR_CODES,
  QUALITY_ISSUE_DETAIL_ACTION
} from '../../../../shared/constants'
import { qualityIssueDetails } from '../../../database/schema'
import db from '../../../database'
import { uploadAttachment } from '../../../utils/attachment-api'
import { parseAttachmentId } from '../../../utils/attachment-validation'
import { createApiError } from '../../../utils/api-error'

export default eventHandler(async (event) => {
  const issueId = parseAttachmentId(getRouterParam(event, 'id'))
  const [initialEvidence] = await db
    .select({ id: qualityIssueDetails.id })
    .from(qualityIssueDetails)
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
    exists: async () => true
  })
})
