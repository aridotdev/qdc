import { qualityIssueProgressSchema } from '../../../../shared/validators/quality-issues'
import { ERROR_CODES } from '../../../../shared/constants'
import { getAuthActor } from '../../../lib/auth-http'
import { createApiError, toApiError } from '../../../utils/api-error'
import { createRuntimeQualityIssueRepository, createRuntimeQualityIssueService, getQualityIssueDetailOrThrow, parseQualityIssueId, readQualityIssuePayload } from '../../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const issueId = parseQualityIssueId(getRouterParam(event, 'id'))
  const { payload, files } = await readQualityIssuePayload(event, qualityIssueProgressSchema)

  try {
    const created = await createRuntimeQualityIssueService().addProgress(issueId, {
      tanggal: payload.tanggal,
      action: payload.action,
      remark: payload.remark,
      attachments: files
    }, { actorUserId: actor.userId })
    const issue = getQualityIssueDetailOrThrow(
      await createRuntimeQualityIssueRepository().findDetailById(issueId),
      issueId
    )
    const detail = issue.details.find(item => item.id === created.detailId)

    if (!detail) {
      throw createApiError({ code: ERROR_CODES.NOT_FOUND })
    }

    setResponseStatus(event, 201)
    return { ...created, detail }
  } catch (error) {
    throw toApiError(error)
  }
})
