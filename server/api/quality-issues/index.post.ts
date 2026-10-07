import { createQualityIssueSchema } from '../../../shared/validators/quality-issues'
import { ERROR_CODES } from '../../../shared/constants'
import { getAuthActor } from '../../lib/auth-http'
import { createApiError, toApiError } from '../../utils/api-error'
import { createRuntimeQualityIssueRepository, createRuntimeQualityIssueService, readQualityIssuePayload } from '../../utils/quality-issue-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const { payload, files } = await readQualityIssuePayload(event, createQualityIssueSchema)
  const service = createRuntimeQualityIssueService()

  try {
    const created = await service.create({
      issueName: payload.issue_name,
      modelName: payload.model_name,
      serialNumber: payload.serial_number,
      tanggalKejadian: payload.tanggal_kejadian,
      notificationNumber: payload.notification_number,
      detail: payload.detail,
      keterangan: payload.keterangan,
      attachments: files
    }, { actorUserId: actor.userId })
    const issue = await createRuntimeQualityIssueRepository().findDetailById(created.issueId)

    if (!issue) {
      throw createApiError({ code: ERROR_CODES.NOT_FOUND })
    }

    setResponseStatus(event, 201)
    return { ...created, issue }
  } catch (error) {
    throw toApiError(error)
  }
})
