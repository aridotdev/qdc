import { handoverSampleDefectSchema } from '../../../../shared/validators/sample-defects'
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
  const result = handoverSampleDefectSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  try {
    await createRuntimeSampleDefectStateMachine().handover(sampleId, {
      namaPenerimaPqa: result.data.nama_penerima_pqa,
      tanggalSerahPqa: result.data.tanggal_serah_pqa
    }, { actor: { userId: actor.userId, role: actor.role } })

    return getSampleDefectDetailOrThrow(sampleId)
  } catch (error) {
    throw toApiError(error)
  }
})
