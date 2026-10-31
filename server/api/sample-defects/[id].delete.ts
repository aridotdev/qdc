import { getAuthActor } from '../../lib/auth-http'
import { requireAdmin } from '../../lib/auth-policy'
import { toApiError } from '../../utils/api-error'
import { deleteSampleDefect, parseSampleDefectId } from '../../utils/sample-defect-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  requireAdmin(actor)
  const sampleId = parseSampleDefectId(getRouterParam(event, 'id'))

  try {
    await deleteSampleDefect(sampleId, actor.userId)
    return { success: true }
  } catch (error) {
    throw toApiError(error)
  }
})
