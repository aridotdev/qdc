import { createSampleDefectBatchSchema } from '../../../shared/validators/sample-defects'
import { getAuthActor } from '../../lib/auth-http'
import { createValidationError, toApiError } from '../../utils/api-error'
import { createRuntimeSampleDefectBatchService } from '../../utils/sample-defect-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const result = createSampleDefectBatchSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  try {
    const created = await createRuntimeSampleDefectBatchService().createBatch({
      issueId: result.data.issue_id,
      notificationNumber: result.data.notification_number,
      modelName: result.data.model_name,
      serialNumber: result.data.serial_number,
      cabang: result.data.cabang,
      parts: result.data.parts.map(part => ({
        partNumber: part.part_number,
        partName: part.part_name,
        kerusakanCabang: part.kerusakan_cabang
      }))
    }, actor.userId)

    setResponseStatus(event, 201)
    return created
  } catch (error) {
    throw toApiError(error)
  }
})
