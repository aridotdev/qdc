import { sampleDefectListQuerySchema } from '../../../shared/validators/sample-defects'
import { getAuthActor } from '../../lib/auth-http'
import { createValidationError } from '../../utils/api-error'
import { createRuntimeSampleDefectRepository } from '../../utils/sample-defect-api'

export default eventHandler(async (event) => {
  getAuthActor(event)
  const result = sampleDefectListQuerySchema.safeParse(getQuery(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  return createRuntimeSampleDefectRepository().list(result.data)
})
