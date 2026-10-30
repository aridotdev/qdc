import { getAuthActor } from '../../../lib/auth-http'
import { requireAdmin } from '../../../lib/auth-policy'
import { toApiError } from '../../../utils/api-error'
import {
  createRuntimeQualityIssueRepository,
  createRuntimeQualityIssueService,
  getQualityIssueDetailOrThrow,
  resolveQualityIssueId
} from '../../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  requireAdmin(actor)
  const issueId = await resolveQualityIssueId(getRouterParam(event, 'id'), { includeDeleted: true })

  try {
    await createRuntimeQualityIssueService().restore(issueId, { actorUserId: actor.userId })
    return getQualityIssueDetailOrThrow(
      await createRuntimeQualityIssueRepository().findDetailById(issueId),
      issueId
    )
  } catch (error) {
    throw toApiError(error)
  }
})
