import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AUDIT_ACTION,
  ERROR_CODES,
  SAMPLE_CONDITION,
  SAMPLE_DEFECT_STATUS,
  USER_ROLE
} from '../../shared/constants'
import { createDatabase } from '../../server/database/client'
import { attachments, auditLogs } from '../../server/database/schema'
import { createSampleDefectRepository } from '../../server/repositories/sample-defects'
import { createAttachmentService } from '../../server/services/attachments'
import { createFileStorage, type FileStorage } from '../../server/services/file-storage'
import {
  createSampleDefectStateMachine,
  SampleDefectRollbackForbiddenError
} from '../../server/services/sample-defect-state-machine'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const now = new Date('2026-10-31T00:00:00.000Z')

describe('Sample Defect state machine service', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let repository: ReturnType<typeof createSampleDefectRepository>
  let stateMachine: ReturnType<typeof createSampleDefectStateMachine>
  let directory: string
  let sequence = 0
  let photoSequence = 0

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-sample-defect-state-machine-'))
    database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
    repository = createSampleDefectRepository({ db: database.db })
    const storage = createFileStorage({
      rootDir: join(directory, 'uploads'),
      clock: () => now,
      idGenerator: () => `pqa-photo-${++photoSequence}`
    })
    const attachmentService = createAttachmentService({
      db: database.db,
      storage,
      clock: () => now
    })
    stateMachine = createSampleDefectStateMachine({
      db: database.db,
      attachments: attachmentService,
      clock: () => now
    })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  async function createSample(status = SAMPLE_DEFECT_STATUS.REQUESTED) {
    sequence += 1
    const timestamp = now.toISOString()

    return repository.create({
      batchId: `STATE-BATCH-${sequence}`,
      notificationNumber: `STATE-NOTIF-${sequence}`,
      modelName: 'MODEL-STATE',
      serialNumber: `STATE-SN-${sequence}`,
      cabang: 'Jakarta',
      partNumber: `STATE-PART-${sequence}`,
      partName: 'State test part',
      kerusakanCabang: 'State test damage',
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUserId: 'creator-1',
      updatedByUserId: 'creator-1'
    })
  }

  const userActor = { userId: 'user-1', role: USER_ROLE.USER }
  const adminActor = { userId: 'admin-1', role: USER_ROLE.ADMIN }

  it('receives a requested sample, stores receipt data, and records an audit event', async () => {
    const sample = await createSample()

    const received = await stateMachine.receive(sample.id, {
      tanggalTerima: '2026-10-31T04:00:00.000Z',
      keteranganTerima: 'Diterima lengkap oleh gudang'
    }, { actor: userActor })

    expect(received).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.RECEIVED,
      tanggalTerima: '2026-10-31T04:00:00.000Z',
      keteranganTerima: 'Diterima lengkap oleh gudang',
      updatedByUserId: userActor.userId
    })

    const [event] = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))

    expect(event).toMatchObject({
      action: AUDIT_ACTION.STATUS_CHANGE,
      fromStatus: SAMPLE_DEFECT_STATUS.REQUESTED,
      toStatus: SAMPLE_DEFECT_STATUS.RECEIVED,
      actorUserId: userActor.userId
    })
    expect(JSON.parse(event?.metadataJson ?? '{}')).toEqual({ operation: 'RECEIVE' })
  })

  it('rejects repeated receive and receive from a non-requested state', async () => {
    const sample = await createSample()

    await stateMachine.receive(sample.id, {
      tanggalTerima: '2026-10-31T05:00:00.000Z'
    }, { actor: userActor })

    await expect(stateMachine.receive(sample.id, {
      tanggalTerima: '2026-10-31T06:00:00.000Z'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.RECEIVED,
      toStatus: SAMPLE_DEFECT_STATUS.QRCC_VERIFIED
    })

    const unchanged = await repository.findById(sample.id)
    expect(unchanged).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.RECEIVED,
      tanggalTerima: '2026-10-31T05:00:00.000Z'
    })

    const events = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))
    expect(events).toHaveLength(1)

    const alreadyVerified = await createSample(SAMPLE_DEFECT_STATUS.QRCC_VERIFIED)
    await expect(stateMachine.receive(alreadyVerified.id, {
      tanggalTerima: '2026-10-31T07:00:00.000Z'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.QRCC_VERIFIED,
      toStatus: SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA
    })
  })

  it('verifies a received sample, stores the result, and records an audit event', async () => {
    const sample = await createSample()

    await stateMachine.receive(sample.id, {
      tanggalTerima: '2026-10-31T08:00:00.000Z'
    }, { actor: userActor })

    const verified = await stateMachine.verify(sample.id, {
      kerusakanVerifikasi: '  Retak pada housing  '
    }, { actor: userActor })

    expect(verified).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.QRCC_VERIFIED,
      kerusakanVerifikasi: 'Retak pada housing',
      updatedByUserId: userActor.userId
    })

    const events = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))

    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      action: AUDIT_ACTION.STATUS_CHANGE,
      fromStatus: SAMPLE_DEFECT_STATUS.RECEIVED,
      toStatus: SAMPLE_DEFECT_STATUS.QRCC_VERIFIED,
      actorUserId: userActor.userId
    })
    expect(JSON.parse(events[1]?.metadataJson ?? '{}')).toEqual({ operation: 'VERIFY' })
  })

  it('rejects verification with a missing result or an invalid state', async () => {
    const missingResult = await createSample(SAMPLE_DEFECT_STATUS.RECEIVED)

    await expect(stateMachine.verify(missingResult.id, {
      kerusakanVerifikasi: ' '
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      field: 'kerusakanVerifikasi'
    })

    const requested = await createSample()
    await expect(stateMachine.verify(requested.id, {
      kerusakanVerifikasi: 'Tidak boleh diverifikasi'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.REQUESTED,
      toStatus: SAMPLE_DEFECT_STATUS.RECEIVED
    })

    const verified = await stateMachine.verify(missingResult.id, {
      kerusakanVerifikasi: 'Retak pada housing'
    }, { actor: userActor })
    await expect(stateMachine.verify(verified.id, {
      kerusakanVerifikasi: 'Hasil kedua'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.QRCC_VERIFIED,
      toStatus: SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA
    })
  })

  it('hands over a verified sample, stores the PIC and timestamp, and records an audit event', async () => {
    const sample = await createSample(SAMPLE_DEFECT_STATUS.QRCC_VERIFIED)

    const handedOver = await stateMachine.handover(sample.id, {
      namaPenerimaPqa: '  PQA User  ',
      tanggalSerahPqa: ' 2026-10-31T09:00:00.000Z '
    }, { actor: userActor })

    expect(handedOver).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA,
      namaPenerimaPqa: 'PQA User',
      tanggalSerahPqa: '2026-10-31T09:00:00.000Z',
      updatedByUserId: userActor.userId
    })

    const [event] = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))

    expect(event).toMatchObject({
      action: AUDIT_ACTION.STATUS_CHANGE,
      fromStatus: SAMPLE_DEFECT_STATUS.QRCC_VERIFIED,
      toStatus: SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA,
      actorUserId: userActor.userId
    })
    expect(JSON.parse(event?.metadataJson ?? '{}')).toEqual({ operation: 'HANDOVER' })
  })

  it('rejects handover with missing fields, invalid state, or repeated operation', async () => {
    const missingPic = await createSample(SAMPLE_DEFECT_STATUS.QRCC_VERIFIED)
    await expect(stateMachine.handover(missingPic.id, {
      namaPenerimaPqa: ' ',
      tanggalSerahPqa: '2026-10-31T09:00:00.000Z'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      field: 'namaPenerimaPqa'
    })

    const missingTimestamp = await createSample(SAMPLE_DEFECT_STATUS.QRCC_VERIFIED)
    await expect(stateMachine.handover(missingTimestamp.id, {
      namaPenerimaPqa: 'PQA User',
      tanggalSerahPqa: ' '
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      field: 'tanggalSerahPqa'
    })

    const requested = await createSample()
    await expect(stateMachine.handover(requested.id, {
      namaPenerimaPqa: 'PQA User',
      tanggalSerahPqa: '2026-10-31T09:00:00.000Z'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.REQUESTED,
      toStatus: SAMPLE_DEFECT_STATUS.RECEIVED
    })

    const repeated = await createSample(SAMPLE_DEFECT_STATUS.QRCC_VERIFIED)
    await stateMachine.handover(repeated.id, {
      namaPenerimaPqa: 'PQA User',
      tanggalSerahPqa: '2026-10-31T09:00:00.000Z'
    }, { actor: userActor })
    await expect(stateMachine.handover(repeated.id, {
      namaPenerimaPqa: 'PQA User 2',
      tanggalSerahPqa: '2026-10-31T10:00:00.000Z'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA,
      toStatus: SAMPLE_DEFECT_STATUS.PQA_ANALYZED
    })
  })

  it('completes PQA analysis, preserves verification, and stores an optional photo', async () => {
    const sample = await createSample(SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA)

    const analyzed = await stateMachine.pqaAnalysis(sample.id, {
      kondisiPqa: SAMPLE_CONDITION.NDF,
      kerusakanVerifikasi: '  Retak terkonfirmasi QRCC  ',
      repair: '  Tidak perlu repair  ',
      photo: {
        fileName: 'pqa-result.png',
        mimeType: 'image/png',
        data: new TextEncoder().encode('pqa photo')
      }
    }, { actor: userActor })

    expect(analyzed).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.PQA_ANALYZED,
      kondisiPqa: SAMPLE_CONDITION.NDF,
      repair: 'Tidak perlu repair',
      kerusakanVerifikasi: 'Retak terkonfirmasi QRCC',
      updatedByUserId: userActor.userId
    })

    const [photo] = await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.sampleId, sample.id))
    expect(photo).toMatchObject({
      fileName: 'pqa-result.png',
      fileType: 'image/png',
      sampleId: sample.id,
      fileUrl: `/api/attachments/${photo?.id}`
    })
    const persistedSample = await repository.findById(sample.id)
    expect(photo?.storageName).toBe(
      `sample-defect/2026/${persistedSample?.businessId}/pqa-photo-1`
    )
  })

  it('rejects invalid PQA condition and state without changing the sample', async () => {
    const invalidCondition = await createSample(SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA)

    await expect(stateMachine.pqaAnalysis(invalidCondition.id, {
      kondisiPqa: 'INVALID' as never,
      repair: 'Repair'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      field: 'kondisiPqa'
    })

    const requested = await createSample()
    await expect(stateMachine.pqaAnalysis(requested.id, {
      kondisiPqa: SAMPLE_CONDITION.NG,
      repair: 'Repair'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.REQUESTED,
      toStatus: SAMPLE_DEFECT_STATUS.RECEIVED
    })

    const unchanged = await repository.findById(requested.id)
    expect(unchanged).toMatchObject({ status: SAMPLE_DEFECT_STATUS.REQUESTED })
  })

  it('does not change PQA state when photo attachment upload fails', async () => {
    const failingStorage: FileStorage = {
      rootDir: join(directory, 'uploads-failure'),
      publicPath: '/uploads',
      resolvePath: storageName => join(directory, 'uploads-failure', storageName),
      write: async () => {
        throw new Error('photo write failed')
      },
      remove: async () => {},
      list: async () => []
    }
    const failingStateMachine = createSampleDefectStateMachine({
      db: database.db,
      attachments: createAttachmentService({
        db: database.db,
        storage: failingStorage,
        clock: () => now
      }),
      clock: () => now
    })
    const sample = await createSample(SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA)

    await expect(failingStateMachine.pqaAnalysis(sample.id, {
      kondisiPqa: SAMPLE_CONDITION.NG,
      repair: 'Ganti housing',
      photo: {
        fileName: 'pqa-failure.png',
        mimeType: 'image/png',
        data: new TextEncoder().encode('pqa photo')
      }
    }, { actor: userActor })).rejects.toThrow('photo write failed')

    expect(await repository.findById(sample.id)).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA
    })
    expect(await database.db
      .select()
      .from(attachments)
      .where(eq(attachments.sampleId, sample.id))).toEqual([])
    expect(await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))).toEqual([])
  })

  it('completes supplier analysis per part and records an audit event', async () => {
    const sample = await createSample(SAMPLE_DEFECT_STATUS.PQA_ANALYZED)

    const completed = await stateMachine.supplierAnalysis(sample.id, {
      hasilAnalisaSupplier: '  Material tidak sesuai spesifikasi  '
    }, { actor: userActor })

    expect(completed).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.SUPPLIER_ANALYZED,
      hasilAnalisaSupplier: 'Material tidak sesuai spesifikasi',
      updatedByUserId: userActor.userId
    })

    const [event] = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))

    expect(event).toMatchObject({
      action: AUDIT_ACTION.STATUS_CHANGE,
      fromStatus: SAMPLE_DEFECT_STATUS.PQA_ANALYZED,
      toStatus: SAMPLE_DEFECT_STATUS.SUPPLIER_ANALYZED,
      actorUserId: userActor.userId
    })
    expect(JSON.parse(event?.metadataJson ?? '{}')).toEqual({ operation: 'SUPPLIER_ANALYSIS' })
  })

  it('rejects missing, invalid-state, and repeated supplier analysis', async () => {
    const missingConclusion = await createSample(SAMPLE_DEFECT_STATUS.PQA_ANALYZED)
    await expect(stateMachine.supplierAnalysis(missingConclusion.id, {
      hasilAnalisaSupplier: ' '
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      field: 'hasilAnalisaSupplier'
    })

    const handedOver = await createSample(SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA)
    await expect(stateMachine.supplierAnalysis(handedOver.id, {
      hasilAnalisaSupplier: 'Belum dapat dianalisis'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA,
      toStatus: SAMPLE_DEFECT_STATUS.PQA_ANALYZED
    })

    const repeated = await createSample(SAMPLE_DEFECT_STATUS.PQA_ANALYZED)
    await stateMachine.supplierAnalysis(repeated.id, {
      hasilAnalisaSupplier: 'Kesimpulan pertama'
    }, { actor: userActor })
    await expect(stateMachine.supplierAnalysis(repeated.id, {
      hasilAnalisaSupplier: 'Kesimpulan kedua'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.SUPPLIER_ANALYZED,
      toStatus: null
    })
  })

  it('moves through every canonical state and records each audit event', async () => {
    const sample = await createSample()

    const received = await stateMachine.receive(sample.id, {
      tanggalTerima: '2026-10-31T01:00:00.000Z',
      keteranganTerima: 'Diterima oleh gudang'
    }, { actor: userActor })
    const verified = await stateMachine.verify(sample.id, {
      kerusakanVerifikasi: 'Retak pada housing'
    }, { actor: userActor })
    const handedOver = await stateMachine.handover(sample.id, {
      namaPenerimaPqa: 'PQA User',
      tanggalSerahPqa: '2026-10-31T02:00:00.000Z'
    }, { actor: userActor })
    const analyzed = await stateMachine.pqaAnalysis(sample.id, {
      kondisiPqa: SAMPLE_CONDITION.NG,
      repair: 'Ganti housing'
    }, { actor: userActor })
    const completed = await stateMachine.supplierAnalysis(sample.id, {
      hasilAnalisaSupplier: 'Material tidak sesuai spesifikasi'
    }, { actor: userActor })

    expect(received.status).toBe(SAMPLE_DEFECT_STATUS.RECEIVED)
    expect(verified.status).toBe(SAMPLE_DEFECT_STATUS.QRCC_VERIFIED)
    expect(handedOver.status).toBe(SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA)
    expect(analyzed.status).toBe(SAMPLE_DEFECT_STATUS.PQA_ANALYZED)
    expect(completed).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.SUPPLIER_ANALYZED,
      tanggalTerima: '2026-10-31T01:00:00.000Z',
      kerusakanVerifikasi: 'Retak pada housing',
      namaPenerimaPqa: 'PQA User',
      kondisiPqa: SAMPLE_CONDITION.NG,
      hasilAnalisaSupplier: 'Material tidak sesuai spesifikasi',
      updatedByUserId: userActor.userId
    })

    const events = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))

    expect(events).toHaveLength(5)
    expect(events.map(event => [event.action, event.fromStatus, event.toStatus])).toEqual([
      [AUDIT_ACTION.STATUS_CHANGE, SAMPLE_DEFECT_STATUS.REQUESTED, SAMPLE_DEFECT_STATUS.RECEIVED],
      [AUDIT_ACTION.STATUS_CHANGE, SAMPLE_DEFECT_STATUS.RECEIVED, SAMPLE_DEFECT_STATUS.QRCC_VERIFIED],
      [
        AUDIT_ACTION.STATUS_CHANGE,
        SAMPLE_DEFECT_STATUS.QRCC_VERIFIED,
        SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA
      ],
      [
        AUDIT_ACTION.STATUS_CHANGE,
        SAMPLE_DEFECT_STATUS.HANDED_OVER_TO_PQA,
        SAMPLE_DEFECT_STATUS.PQA_ANALYZED
      ],
      [
        AUDIT_ACTION.STATUS_CHANGE,
        SAMPLE_DEFECT_STATUS.PQA_ANALYZED,
        SAMPLE_DEFECT_STATUS.SUPPLIER_ANALYZED
      ]
    ])
  })

  it('requires operation fields and rejects an operation in the wrong state', async () => {
    const sample = await createSample()

    await expect(stateMachine.receive(sample.id, { tanggalTerima: ' ' }, { actor: userActor }))
      .rejects.toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        field: 'tanggalTerima'
      })
    await expect(stateMachine.verify(sample.id, {
      kerusakanVerifikasi: 'Tidak boleh di state ini'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.REQUESTED
    })
    await expect(stateMachine.pqaAnalysis(sample.id, {
      kondisiPqa: undefined as never,
      repair: 'Repair'
    }, { actor: userActor })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      field: 'kondisiPqa'
    })

    const unchanged = await repository.findById(sample.id)
    expect(unchanged).toMatchObject({ status: SAMPLE_DEFECT_STATUS.REQUESTED })

    const genericUpdated = await stateMachine.update(sample.id, {
      status: SAMPLE_DEFECT_STATUS.RECEIVED
    } as never, { actor: userActor })
    expect(genericUpdated).toMatchObject({
      status: SAMPLE_DEFECT_STATUS.REQUESTED,
      updatedByUserId: userActor.userId
    })
  })

  it('allows one-step admin rollback and rejects non-admin or boundary rollback', async () => {
    const sample = await createSample(SAMPLE_DEFECT_STATUS.RECEIVED)

    const rolledBack = await stateMachine.rollback(sample.id, {
      actor: adminActor,
      reason: 'Perlu penerimaan ulang'
    })
    expect(rolledBack.status).toBe(SAMPLE_DEFECT_STATUS.REQUESTED)

    await expect(stateMachine.rollback(sample.id, { actor: userActor }))
      .rejects.toBeInstanceOf(SampleDefectRollbackForbiddenError)
    await expect(stateMachine.rollback(sample.id, { actor: adminActor })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      fromStatus: SAMPLE_DEFECT_STATUS.REQUESTED
    })

    const [event] = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))
    expect(event).toMatchObject({
      action: AUDIT_ACTION.ROLLBACK,
      fromStatus: SAMPLE_DEFECT_STATUS.RECEIVED,
      toStatus: SAMPLE_DEFECT_STATUS.REQUESTED,
      actorUserId: adminActor.userId
    })
  })

  it('rejects a stale expected version without changing status or writing audit', async () => {
    const sample = await createSample()
    await stateMachine.receive(sample.id, {
      tanggalTerima: '2026-10-31T03:00:00.000Z'
    }, { actor: userActor })

    await expect(stateMachine.verify(sample.id, {
      kerusakanVerifikasi: 'Stale verification'
    }, {
      actor: userActor,
      expectedUpdatedAt: '2026-10-30T00:00:00.000Z'
    })).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })

    const current = await repository.findById(sample.id)
    expect(current?.status).toBe(SAMPLE_DEFECT_STATUS.RECEIVED)
    const events = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sample.id))
    expect(events).toHaveLength(1)
  })
})
