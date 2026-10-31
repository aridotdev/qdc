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
import { auditLogs } from '../../server/database/schema'
import { createSampleDefectRepository } from '../../server/repositories/sample-defects'
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

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-sample-defect-state-machine-'))
    database = await createDatabase(`file:${join(directory, 'database.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
    repository = createSampleDefectRepository({ db: database.db })
    stateMachine = createSampleDefectStateMachine({
      db: database.db,
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
