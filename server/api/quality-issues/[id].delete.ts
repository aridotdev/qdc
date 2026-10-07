import { getAuthActor } from '../../lib/auth-http'
import { requireAdmin } from '../../lib/auth-policy'
import { toApiError } from '../../utils/api-error'
import { createRuntimeQualityIssueService, parseQualityIssueId } from '../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  requireAdmin(actor)
  const issueId = parseQualityIssueId(getRouterParam(event, 'id'))

  try {
    await createRuntimeQualityIssueService().remove(issueId, { actorUserId: actor.userId })
    return { success: true }
  } catch (error) {
    throw toApiError(error)
  }
})
