import { getAuthActor } from '../../lib/auth-http'
import { getSampleDefectDetailOrThrow, parseSampleDefectId } from '../../utils/sample-defect-api'

export default eventHandler(async (event) => {
  getAuthActor(event)
  const sampleId = parseSampleDefectId(getRouterParam(event, 'id'))

  return getSampleDefectDetailOrThrow(sampleId)
})
