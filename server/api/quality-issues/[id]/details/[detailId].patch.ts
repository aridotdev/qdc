import { qualityIssueProgressUpdateSchema } from '../../../../../shared/validators/quality-issues'
import { ERROR_CODES } from '../../../../../shared/constants'
import { getAuthActor } from '../../../../lib/auth-http'
import { createApiError, toApiError } from '../../../../utils/api-error'
import {
  createRuntimeQualityIssueRepository,
  createRuntimeQualityIssueService,
  getQualityIssueDetailOrThrow,
  readQualityIssuePayload,
  resolveQualityIssueId
} from '../../../../utils/quality-issue-api'
import { parseQualityIssueDetailId } from '../../../../utils/quality-issue-validation'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const issueId = await resolveQualityIssueId(getRouterParam(event, 'id'))
  const detailId = parseQualityIssueDetailId(getRouterParam(event, 'detailId'))
  const { payload, files } = await readQualityIssuePayload(
    event,
    qualityIssueProgressUpdateSchema
  )

  try {
    const updated = await createRuntimeQualityIssueService().updateProgress(
      issueId,
      detailId,
      {
        action: payload.action,
        remark: payload.remark || null,
        attachments: files,
        removeAttachmentIds: payload.remove_attachment_ids
      },
      { actorUserId: actor.userId }
    )
    const issue = getQualityIssueDetailOrThrow(
      await createRuntimeQualityIssueRepository().findDetailById(issueId),
      issueId
    )
    const detail = issue.details.find(item => item.id === updated.detailId)

    if (!detail) {
      throw createApiError({ code: ERROR_CODES.NOT_FOUND })
    }

    return { ...updated, detail }
  } catch (error) {
    throw toApiError(error)
  }
})
