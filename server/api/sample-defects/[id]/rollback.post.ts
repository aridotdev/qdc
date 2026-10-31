import { rollbackSampleDefectSchema } from '../../../../shared/validators/sample-defects'
import { getAuthActor } from '../../../lib/auth-http'
import { requireAdmin } from '../../../lib/auth-policy'
import { createValidationError, toApiError } from '../../../utils/api-error'
import {
  createRuntimeSampleDefectStateMachine,
  getSampleDefectDetailOrThrow,
  parseSampleDefectId
} from '../../../utils/sample-defect-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  requireAdmin(actor)
  const sampleId = parseSampleDefectId(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => ({}))
  const result = rollbackSampleDefectSchema.safeParse(body ?? {})

  if (!result.success) {
    throw createValidationError(result.error)
  }

  try {
    await createRuntimeSampleDefectStateMachine().rollback(sampleId, {
      actor: { userId: actor.userId, role: actor.role },
      reason: result.data.reason
    })

    return getSampleDefectDetailOrThrow(sampleId)
  } catch (error) {
    throw toApiError(error)
  }
})
