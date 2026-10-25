import { getAuthActor } from '../../../../lib/auth-http'
import { toApiError } from '../../../../utils/api-error'
import { createRuntimeQualityIssueService, resolveQualityIssueId } from '../../../../utils/quality-issue-api'
import { parseQualityIssueDetailId } from '../../../../utils/quality-issue-validation'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const issueId = await resolveQualityIssueId(getRouterParam(event, 'id'))
  const detailId = parseQualityIssueDetailId(getRouterParam(event, 'detailId'))

  try {
    await createRuntimeQualityIssueService().removeProgress(issueId, detailId, {
      actorUserId: actor.userId
    })

    return { success: true }
  } catch (error) {
    throw toApiError(error)
  }
})
