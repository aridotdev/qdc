import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq, inArray } from 'drizzle-orm'
import { createDatabase } from '../../server/database/client'
import {
  attachments,
  qualityIssueDetails,
  qualityIssues,
  sampleDefects,
  technicalReports
} from '../../server/database/schema'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const now = '2026-09-26T00:00:00.000Z'

describe('Attachment schema', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let directory: string

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-attachments-'))
    database = await createDatabase(`file:${join(directory, 'test.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('creates the attachments table with the canonical columns and constraints', async () => {
    const tables = await database.client.execute({
      sql: 'SELECT name FROM sqlite_master WHERE type = ? AND name = ?',
      args: ['table', 'attachments']
    })
    const table = await database.client.execute({
      sql: 'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
      args: ['table', 'attachments']
    })

    expect(tables.rows).toEqual([{ name: 'attachments' }])
    expect(String(table.rows[0]?.sql)).toContain('attachments_single_owner_check')
    expect(String(table.rows[0]?.sql)).toContain('ON DELETE CASCADE')
  })

  it('rejects an attachment without an owner', async () => {
    await expect(
      database.db.insert(attachments).values({
        fileName: 'evidence.png',
        storageName: '2026/09/26/evidence.png',
        fileUrl: '/uploads/2026/09/26/evidence.png',
        fileType: 'image/png',
        fileSize: 1024,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
    ).rejects.toThrow()
  })

  it('rejects an attachment with multiple owners', async () => {
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Attachment owner test',
        modelName: 'MODEL-ATTACHMENT',
        serialNumber: 'SN-ATTACHMENT',
        tanggalKejadian: '2026-09-26',
        detail: 'Issue untuk pengujian owner attachment.',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssues.id })

    const [detail] = await database.db
      .insert(qualityIssueDetails)
      .values({
        issueId: issue!.id,
        tanggal: now,
        action: 'INITIAL_EVIDENCE',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssueDetails.id })

    const [sample] = await database.db
      .insert(sampleDefects)
      .values({
        batchId: 'attachment-owner-batch',
        notificationNumber: 'ATTACHMENT-OWNER',
        modelName: 'MODEL-ATTACHMENT',
        serialNumber: 'SN-ATTACHMENT',
        cabang: 'Jakarta',
        partNumber: 'PART-ATTACHMENT',
        partName: 'Attachment owner test part',
        kerusakanCabang: 'Test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: sampleDefects.id })

    await expect(
      database.db.insert(attachments).values({
        detailId: detail!.id,
        sampleId: sample!.id,
        fileName: 'evidence.png',
        storageName: '2026/09/26/multiple-owner.png',
        fileUrl: '/uploads/2026/09/26/multiple-owner.png',
        fileType: 'image/png',
        fileSize: 1024,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
    ).rejects.toThrow()
  })

  it('supports each valid owner type and loads attachments through relations', async () => {
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Valid attachment owner test',
        modelName: 'MODEL-VALID-OWNER',
        serialNumber: 'SN-VALID-OWNER',
        tanggalKejadian: '2026-09-26',
        detail: 'Issue untuk pengujian owner valid.',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssues.id })

    const [detail] = await database.db
      .insert(qualityIssueDetails)
      .values({
        issueId: issue!.id,
        tanggal: now,
        action: 'INITIAL_EVIDENCE',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssueDetails.id })

    const [sample] = await database.db
      .insert(sampleDefects)
      .values({
        batchId: 'valid-owner-batch',
        notificationNumber: 'VALID-OWNER',
        modelName: 'MODEL-VALID-OWNER',
        serialNumber: 'SN-VALID-OWNER',
        cabang: 'Jakarta',
        partNumber: 'PART-VALID-OWNER',
        partName: 'Valid owner test part',
        kerusakanCabang: 'Test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: sampleDefects.id })

    const [report] = await database.db
      .insert(technicalReports)
      .values({
        documentNumber: 'TR-VALID-OWNER',
        documentType: 'TECHNICAL_REPORT',
        releaseDate: '2026-09-26',
        modelName: 'MODEL-VALID-OWNER',
        issueName: 'Valid attachment owner test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: technicalReports.id })

    await database.db.insert(attachments).values([
      {
        detailId: detail!.id,
        fileName: 'detail.png',
        storageName: '2026/09/26/detail.png',
        fileUrl: '/uploads/2026/09/26/detail.png',
        fileType: 'image/png',
        fileSize: 1024,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      },
      {
        sampleId: sample!.id,
        fileName: 'sample.png',
        storageName: '2026/09/26/sample.png',
        fileUrl: '/uploads/2026/09/26/sample.png',
        fileType: 'image/png',
        fileSize: 1024,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      },
      {
        reportId: report!.id,
        fileName: 'report.pdf',
        storageName: '2026/09/26/report.pdf',
        fileUrl: '/uploads/2026/09/26/report.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      }
    ])

    const detailWithAttachments = await database.db.query.qualityIssueDetails.findFirst({
      where: { id: detail!.id },
      with: { attachments: true }
    })
    const sampleAttachments = await database.db.query.sampleDefects.findFirst({
      where: { id: sample!.id },
      with: { attachments: true }
    })
    const reportAttachments = await database.db.query.technicalReports.findFirst({
      where: { id: report!.id },
      with: { attachments: true }
    })

    expect(detailWithAttachments?.attachments).toHaveLength(1)
    expect(sampleAttachments?.attachments).toHaveLength(1)
    expect(reportAttachments?.attachments).toHaveLength(1)
  })

  it('cascades attachment metadata when each owner is deleted', async () => {
    const [issue] = await database.db
      .insert(qualityIssues)
      .values({
        issueName: 'Cascade attachment owner test',
        modelName: 'MODEL-CASCADE',
        serialNumber: 'SN-CASCADE',
        tanggalKejadian: '2026-09-26',
        detail: 'Issue untuk pengujian cascade attachment.',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssues.id })

    const [detail] = await database.db
      .insert(qualityIssueDetails)
      .values({
        issueId: issue!.id,
        tanggal: now,
        action: 'INITIAL_EVIDENCE',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: qualityIssueDetails.id })

    const [sample] = await database.db
      .insert(sampleDefects)
      .values({
        batchId: 'cascade-owner-batch',
        notificationNumber: 'CASCADE-OWNER',
        modelName: 'MODEL-CASCADE',
        serialNumber: 'SN-CASCADE',
        cabang: 'Jakarta',
        partNumber: 'PART-CASCADE',
        partName: 'Cascade owner test part',
        kerusakanCabang: 'Test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: sampleDefects.id })

    const [report] = await database.db
      .insert(technicalReports)
      .values({
        documentNumber: 'TR-CASCADE-OWNER',
        documentType: 'SERVICE_TIPS',
        releaseDate: '2026-09-26',
        modelName: 'MODEL-CASCADE',
        issueName: 'Cascade owner test',
        createdAt: now,
        updatedAt: now,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1'
      })
      .returning({ id: technicalReports.id })

    const insertedAttachments = await database.db
      .insert(attachments)
      .values([
        {
          detailId: detail!.id,
          fileName: 'detail-cascade.png',
          storageName: '2026/09/26/detail-cascade.png',
          fileUrl: '/uploads/2026/09/26/detail-cascade.png',
          fileType: 'image/png',
          fileSize: 1024,
          createdAt: now,
          updatedAt: now,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1'
        },
        {
          sampleId: sample!.id,
          fileName: 'sample-cascade.png',
          storageName: '2026/09/26/sample-cascade.png',
          fileUrl: '/uploads/2026/09/26/sample-cascade.png',
          fileType: 'image/png',
          fileSize: 1024,
          createdAt: now,
          updatedAt: now,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1'
        },
        {
          reportId: report!.id,
          fileName: 'report-cascade.pdf',
          storageName: '2026/09/26/report-cascade.pdf',
          fileUrl: '/uploads/2026/09/26/report-cascade.pdf',
          fileType: 'application/pdf',
          fileSize: 2048,
          createdAt: now,
          updatedAt: now,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1'
        }
      ])
      .returning({ id: attachments.id })

    await database.db.delete(qualityIssues).where(eq(qualityIssues.id, issue!.id))
    await database.db.delete(sampleDefects).where(eq(sampleDefects.id, sample!.id))
    await database.db.delete(technicalReports).where(eq(technicalReports.id, report!.id))

    const remaining = await database.db
      .select({ id: attachments.id })
      .from(attachments)
      .where(
        inArray(
          attachments.id,
          insertedAttachments.map(attachment => attachment.id)
        )
      )

    expect(remaining).toEqual([])
  })
})
