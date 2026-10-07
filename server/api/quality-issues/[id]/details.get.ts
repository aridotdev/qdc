import { getAuthActor } from '../../../lib/auth-http'
import { createRuntimeQualityIssueRepository, getQualityIssueDetailOrThrow, parseQualityIssueId } from '../../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  getAuthActor(event)
  const issueId = parseQualityIssueId(getRouterParam(event, 'id'))
  const issue = getQualityIssueDetailOrThrow(
    await createRuntimeQualityIssueRepository().findDetailById(issueId),
    issueId
  )

  return {
    issueId,
    details: issue.details
  }
})
