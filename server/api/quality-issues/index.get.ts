import { qualityIssueListQuerySchema } from '../../../shared/validators/quality-issues'
import { getAuthActor } from '../../lib/auth-http'
import { requireAdmin } from '../../lib/auth-policy'
import { createValidationError } from '../../utils/api-error'
import { createRuntimeQualityIssueRepository } from '../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const result = qualityIssueListQuerySchema.safeParse(getQuery(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  if (result.data.view !== 'active') {
    requireAdmin(actor)
  }

  return createRuntimeQualityIssueRepository().list(result.data)
})
