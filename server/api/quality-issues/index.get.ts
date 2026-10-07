import { qualityIssueListQuerySchema } from '../../../shared/validators/quality-issues'
import { getAuthActor } from '../../lib/auth-http'
import { createValidationError } from '../../utils/api-error'
import { createRuntimeQualityIssueRepository } from '../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  getAuthActor(event)
  const result = qualityIssueListQuerySchema.safeParse(getQuery(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  return createRuntimeQualityIssueRepository().list(result.data)
})
