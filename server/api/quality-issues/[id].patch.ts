import { updateQualityIssueSchema } from '../../../shared/validators/quality-issues'
import { getAuthActor } from '../../lib/auth-http'
import { createValidationError, toApiError } from '../../utils/api-error'
import { createRuntimeQualityIssueRepository, createRuntimeQualityIssueService, getQualityIssueDetailOrThrow, parseQualityIssueId } from '../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const issueId = parseQualityIssueId(getRouterParam(event, 'id'))
  const result = updateQualityIssueSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  try {
    await createRuntimeQualityIssueService().update(issueId, {
      issueName: result.data.issue_name,
      modelName: result.data.model_name,
      serialNumber: result.data.serial_number,
      tanggalKejadian: result.data.tanggal_kejadian,
      notificationNumber: result.data.notification_number,
      detail: result.data.detail,
      keterangan: result.data.keterangan
    }, { actorUserId: actor.userId })

    return getQualityIssueDetailOrThrow(
      await createRuntimeQualityIssueRepository().findDetailById(issueId),
      issueId
    )
  } catch (error) {
    throw toApiError(error)
  }
})
