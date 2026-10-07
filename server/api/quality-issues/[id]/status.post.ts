import { qualityIssueStatusOperationSchema } from '../../../../shared/validators/quality-issues'
import { getAuthActor } from '../../../lib/auth-http'
import { requireAdmin } from '../../../lib/auth-policy'
import { createValidationError, toApiError } from '../../../utils/api-error'
import { createRuntimeQualityIssueStateMachine, parseQualityIssueId } from '../../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const issueId = parseQualityIssueId(getRouterParam(event, 'id'))
  const result = qualityIssueStatusOperationSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  if (result.data.operation === 'ROLLBACK') {
    requireAdmin(actor)
  }

  try {
    const stateMachine = createRuntimeQualityIssueStateMachine()
    const context = {
      actor: {
        userId: actor.userId,
        role: actor.role
      },
      reason: result.data.reason
    }
    const issue = result.data.operation === 'FORWARD'
      ? await stateMachine.forward(issueId, context)
      : await stateMachine.rollback(issueId, context)

    return issue
  } catch (error) {
    throw toApiError(error)
  }
})
