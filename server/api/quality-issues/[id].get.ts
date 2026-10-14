import { getAuthActor } from '../../lib/auth-http'
import { createRuntimeQualityIssueRepository, getQualityIssueDetailOrThrow, resolveQualityIssueId } from '../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  getAuthActor(event)
  const issueId = await resolveQualityIssueId(getRouterParam(event, 'id'))
  const issue = await createRuntimeQualityIssueRepository().findDetailById(issueId)

  return getQualityIssueDetailOrThrow(issue, issueId)
})
