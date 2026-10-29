import { getAuthActor } from '../../lib/auth-http'
import { requireAdmin } from '../../lib/auth-policy'
import { qualityIssueDeleteSchema } from '../../../shared/validators/quality-issues'
import { createValidationError, toApiError } from '../../utils/api-error'
import { createRuntimeQualityIssueService, resolveQualityIssueId } from '../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  requireAdmin(actor)
  const issueId = await resolveQualityIssueId(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => ({}))
  const result = qualityIssueDeleteSchema.safeParse(body ?? {})

  if (!result.success) {
    throw createValidationError(result.error)
  }

  try {
    await createRuntimeQualityIssueService().remove(
      issueId,
      { actorUserId: actor.userId },
      { reason: result.data.reason }
    )
    return { success: true }
  } catch (error) {
    throw toApiError(error)
  }
})
