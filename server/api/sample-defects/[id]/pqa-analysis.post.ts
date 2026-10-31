import { pqaAnalysisSampleDefectSchema } from '../../../../shared/validators/sample-defects'
import { getAuthActor } from '../../../lib/auth-http'
import { toApiError } from '../../../utils/api-error'
import {
  createRuntimeSampleDefectStateMachine,
  getSampleDefectDetailOrThrow,
  parseSampleDefectId,
  readSampleDefectPayload,
  requireSinglePhoto
} from '../../../utils/sample-defect-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const sampleId = parseSampleDefectId(getRouterParam(event, 'id'))
  const { payload, files } = await readSampleDefectPayload(event, pqaAnalysisSampleDefectSchema)
  const photo = requireSinglePhoto(files)

  try {
    await createRuntimeSampleDefectStateMachine().pqaAnalysis(sampleId, {
      kondisiPqa: payload.kondisi_pqa,
      kerusakanVerifikasi: payload.kerusakan_verifikasi,
      repair: payload.repair,
      ...(photo ? { photo } : {})
    }, { actor: { userId: actor.userId, role: actor.role } })

    return getSampleDefectDetailOrThrow(sampleId)
  } catch (error) {
    throw toApiError(error)
  }
})
