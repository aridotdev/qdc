import { updateSampleDefectSchema } from '../../../shared/validators/sample-defects'
import { getAuthActor } from '../../lib/auth-http'
import { createValidationError, toApiError } from '../../utils/api-error'
import {
  createRuntimeSampleDefectStateMachine,
  getSampleDefectDetailOrThrow,
  parseSampleDefectId
} from '../../utils/sample-defect-api'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  const sampleId = parseSampleDefectId(getRouterParam(event, 'id'))
  const result = updateSampleDefectSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createValidationError(result.error)
  }

  try {
    await createRuntimeSampleDefectStateMachine().update(sampleId, {
      issueId: result.data.issue_id,
      notificationNumber: result.data.notification_number,
      modelName: result.data.model_name,
      serialNumber: result.data.serial_number,
      cabang: result.data.cabang,
      partNumber: result.data.part_number,
      partName: result.data.part_name,
      kerusakanCabang: result.data.kerusakan_cabang,
      tanggalTerima: result.data.tanggal_terima,
      keteranganTerima: result.data.keterangan_terima,
      namaPenerimaPqa: result.data.nama_penerima_pqa,
      tanggalSerahPqa: result.data.tanggal_serah_pqa,
      kerusakanVerifikasi: result.data.kerusakan_verifikasi,
      kondisiPqa: result.data.kondisi_pqa,
      repair: result.data.repair,
      hasilAnalisaSupplier: result.data.hasil_analisa_supplier
    }, { actor: { userId: actor.userId, role: actor.role } })

    return getSampleDefectDetailOrThrow(sampleId)
  } catch (error) {
    throw toApiError(error)
  }
})
