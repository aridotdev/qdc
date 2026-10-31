import { receiveSampleDefectSchema } from '../../../../shared/validators/sample-defects'
import { getAuthActor } from '../../../lib/auth-http'
import { createValidationError, toApiError } from '../../../utils/api-error'
import {
  createRuntimeSampleDefectStateMachine,
  getSampleDefectDetailOrThrow,
  parseSampleDefectId
} from '../../../utils/sample-defect-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const sampleId = parseSampleDefectId(getRouterParam(event, 'id'))
  const result = receiveSampleDefectSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  try {
    await createRuntimeSampleDefectStateMachine().receive(sampleId, {
      tanggalTerima: result.data.tanggal_terima,
      keteranganTerima: result.data.keterangan_terima
    }, { actor: { userId: actor.userId, role: actor.role } })

    return getSampleDefectDetailOrThrow(sampleId)
  } catch (error) {
    throw toApiError(error)
  }
})
