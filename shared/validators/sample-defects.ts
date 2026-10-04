import { z } from 'zod'
import {
  isoDateTimeSchema,
  nonEmptyUpdateSchema,
  optionalNullableText,
  optionalText,
  paginationSchema,
  queryPositiveIdSchema,
  requiredText,
  sampleConditionSchema,
  sampleDefectStatusSchema
} from './common'

const sampleDefectPartSchema = z.strictObject({
  part_number: requiredText('Part number'),
  part_name: requiredText('Part name'),
  kerusakan_cabang: requiredText('Kerusakan cabang')
})

const sampleDefectFilterShape = {
  batch_id: optionalText('Batch ID'),
  notification_number: optionalText('Nomor notifikasi'),
  status: sampleDefectStatusSchema.optional(),
  model_name: optionalText('Model name'),
  part_number: optionalText('Part number'),
  issue_id: queryPositiveIdSchema.optional()
}

export const createSampleDefectBatchSchema = z.strictObject({
  issue_id: queryPositiveIdSchema.nullable().optional(),
  notification_number: requiredText('Nomor notifikasi'),
  model_name: requiredText('Model name'),
  serial_number: requiredText('Serial number'),
  cabang: requiredText('Cabang'),
  parts: z.array(sampleDefectPartSchema).min(1, 'Minimal satu part harus diisi.')
})

export const createSampleDefectSchema = createSampleDefectBatchSchema

export const updateSampleDefectSchema = nonEmptyUpdateSchema(
  z.strictObject({
    issue_id: queryPositiveIdSchema.nullable().optional(),
    notification_number: optionalText('Nomor notifikasi'),
    model_name: optionalText('Model name'),
    serial_number: optionalText('Serial number'),
    cabang: optionalText('Cabang'),
    part_number: optionalText('Part number'),
    part_name: optionalText('Part name'),
    kerusakan_cabang: optionalText('Kerusakan cabang'),
    tanggal_terima: isoDateTimeSchema.nullable().optional(),
    keterangan_terima: optionalNullableText('Keterangan penerimaan'),
    nama_penerima_pqa: optionalNullableText('Nama penerima PQA'),
    tanggal_serah_pqa: isoDateTimeSchema.nullable().optional(),
    kerusakan_verifikasi: optionalNullableText('Kerusakan verifikasi'),
    kondisi_pqa: sampleConditionSchema.nullable().optional(),
    repair: optionalNullableText('Repair'),
    hasil_analisa_supplier: optionalNullableText('Hasil analisa supplier')
  })
)

export const sampleDefectFilterSchema = z.strictObject(sampleDefectFilterShape)

export const sampleDefectPaginationSchema = z.strictObject({
  ...paginationSchema.shape,
  ...sampleDefectFilterShape
})

export const sampleDefectListQuerySchema = sampleDefectPaginationSchema

export type CreateSampleDefectBatchPayload = z.infer<typeof createSampleDefectBatchSchema>
export type UpdateSampleDefectPayload = z.infer<typeof updateSampleDefectSchema>
export type SampleDefectFilter = z.infer<typeof sampleDefectFilterSchema>
export type SampleDefectPagination = z.infer<typeof sampleDefectPaginationSchema>
