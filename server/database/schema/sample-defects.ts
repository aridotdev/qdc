import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { SAMPLE_CONDITIONS, SAMPLE_DEFECT_STATUS, SAMPLE_DEFECT_STATUSES } from '../../../shared/constants/domain'
import { auditFields } from './_audit-fields'
import { checkEnum } from './_check-enum'
import { qualityIssues } from './quality-issues'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

/**
 * db-schema.md §4 — Sample Defect.
 *
 * `batch_id` dibuat server-side sekali per request dan sama untuk semua
 * part pada request tersebut. `notification_number` boleh sama pada
 * beberapa batch dan BUKAN unique key (karena itu hanya diberi index
 * biasa, bukan unique index).
 */
export const sampleDefects = sqliteTable(
  'sample_defects',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    batchId: text('batch_id').notNull(),
    issueId: integer('issue_id').references(() => qualityIssues.id, { onDelete: 'set null' }),
    notificationNumber: text('notification_number').notNull(),
    modelName: text('model_name').notNull(),
    serialNumber: text('serial_number').notNull(),
    cabang: text('cabang').notNull(),
    partNumber: text('part_number').notNull(),
    partName: text('part_name').notNull(),
    kerusakanCabang: text('kerusakan_cabang').notNull(),
    status: text('status')
      .notNull()
      .default(SAMPLE_DEFECT_STATUS.REQUESTED),
    tanggalTerima: text('tanggal_terima'),
    keteranganTerima: text('keterangan_terima'),
    namaPenerimaPqa: text('nama_penerima_pqa'),
    tanggalSerahPqa: text('tanggal_serah_pqa'),
    kerusakanVerifikasi: text('kerusakan_verifikasi'),
    // 'NG' | 'NDF'
    kondisiPqa: text('kondisi_pqa'),
    repair: text('repair'),
    hasilAnalisaSupplier: text('hasil_analisa_supplier'),
    ...auditFields
  },
  table => [
    index('sample_defects_batch_id_idx').on(table.batchId),
    index('sample_defects_issue_id_idx').on(table.issueId),
    index('sample_defects_notification_number_idx').on(table.notificationNumber),
    index('sample_defects_status_idx').on(table.status),
    index('sample_defects_model_name_part_number_idx').on(table.modelName, table.partNumber),
    check('sample_defects_status_check', checkEnum(table.status, SAMPLE_DEFECT_STATUSES)),
    check(
      'sample_defects_kondisi_pqa_check',
      checkEnum(table.kondisiPqa, SAMPLE_CONDITIONS)
    )
  ]
)

export const insertSampleDefectSchema = createInsertSchema(sampleDefects, {
  batchId: z.string().min(1, 'Batch ID tidak boleh kosong').trim(),
  issueId: z.number().int().positive().nullable().optional(),
  notificationNumber: z.string().min(1, 'Nomor notifikasi tidak boleh kosong').trim(),
  modelName: z.string().min(1, 'Model name tidak boleh kosong').trim(),
  serialNumber: z.string().min(1, 'Serial number tidak boleh kosong').trim(),
  cabang: z.string().min(1, 'Cabang tidak boleh kosong').trim(),
  partNumber: z.string().min(1, 'Part number tidak boleh kosong').trim(),
  partName: z.string().min(1, 'Part name tidak boleh kosong').trim(),
  kerusakanCabang: z.string().min(1, 'Kerusakan cabang tidak boleh kosong').trim(),
  status: z.enum(SAMPLE_DEFECT_STATUSES).optional(),
  tanggalTerima: z.string().nullable().optional(),
  keteranganTerima: z.string().nullable().optional(),
  namaPenerimaPqa: z.string().nullable().optional(),
  tanggalSerahPqa: z.string().nullable().optional(),
  kerusakanVerifikasi: z.string().nullable().optional(),
  kondisiPqa: z.enum(SAMPLE_CONDITIONS).nullable().optional(),
  repair: z.string().nullable().optional(),
  hasilAnalisaSupplier: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true
})

export const selectSampleDefectSchema = createSelectSchema(sampleDefects)

export const updateSampleDefectSchema = createUpdateSchema(sampleDefects, {
  batchId: z.string().min(1, 'Batch ID tidak boleh kosong').trim().optional(),
  issueId: z.number().int().positive().nullable().optional(),
  notificationNumber: z.string().min(1, 'Nomor notifikasi tidak boleh kosong').trim().optional(),
  modelName: z.string().min(1, 'Model name tidak boleh kosong').trim().optional(),
  serialNumber: z.string().min(1, 'Serial number tidak boleh kosong').trim().optional(),
  cabang: z.string().min(1, 'Cabang tidak boleh kosong').trim().optional(),
  partNumber: z.string().min(1, 'Part number tidak boleh kosong').trim().optional(),
  partName: z.string().min(1, 'Part name tidak boleh kosong').trim().optional(),
  kerusakanCabang: z.string().min(1, 'Kerusakan cabang tidak boleh kosong').trim().optional(),
  tanggalTerima: z.string().nullable().optional(),
  keteranganTerima: z.string().nullable().optional(),
  namaPenerimaPqa: z.string().nullable().optional(),
  tanggalSerahPqa: z.string().nullable().optional(),
  kerusakanVerifikasi: z.string().nullable().optional(),
  kondisiPqa: z.enum(SAMPLE_CONDITIONS).nullable().optional(),
  repair: z.string().nullable().optional(),
  hasilAnalisaSupplier: z.string().nullable().optional()
}).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  updatedByUserId: true
})

export type SampleDefect = typeof sampleDefects.$inferSelect
export type InsertSampleDefect = z.infer<typeof insertSampleDefectSchema>
export type UpdateSampleDefect = z.infer<typeof updateSampleDefectSchema>
