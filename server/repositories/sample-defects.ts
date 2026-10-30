import { and, asc, count, desc, eq, like, or } from 'drizzle-orm'
import type { PaginatedResponse } from '../../shared/types'
import type { SampleDefectPagination } from '../../shared/validators/sample-defects'
import type { createDatabase } from '../database/client'
import {
  attachments,
  sampleDefects,
  type Attachment,
  type SampleDefect
} from '../database/schema'
import { createPaginatedResponse, getPaginationOffset, resolveSort } from '../utils/pagination'

type SampleDefectDatabase = Pick<
  Awaited<ReturnType<typeof createDatabase>>['db'],
  'select' | 'insert' | 'update' | 'delete'
>

type SampleDefectSortField = keyof typeof sampleDefectSortFields

export type CreateSampleDefectInput = typeof sampleDefects.$inferInsert
export type UpdateSampleDefectInput = Partial<
  Omit<SampleDefect, 'id' | 'publicId' | 'createdAt' | 'createdByUserId'>
>

export interface SampleDefectRepositoryConfig {
  db: SampleDefectDatabase
}

export interface SampleDefectWithAttachments extends SampleDefect {
  attachments: Attachment[]
}

const sampleDefectSortFields = {
  batchId: sampleDefects.batchId,
  notificationNumber: sampleDefects.notificationNumber,
  modelName: sampleDefects.modelName,
  serialNumber: sampleDefects.serialNumber,
  cabang: sampleDefects.cabang,
  partNumber: sampleDefects.partNumber,
  partName: sampleDefects.partName,
  status: sampleDefects.status,
  createdAt: sampleDefects.createdAt,
  updatedAt: sampleDefects.updatedAt
} as const

function buildListConditions(query: SampleDefectPagination) {
  return and(
    query.batch_id === undefined ? undefined : eq(sampleDefects.batchId, query.batch_id),
    query.notification_number === undefined
      ? undefined
      : eq(sampleDefects.notificationNumber, query.notification_number),
    query.status === undefined ? undefined : eq(sampleDefects.status, query.status),
    query.model_name === undefined ? undefined : eq(sampleDefects.modelName, query.model_name),
    query.part_number === undefined ? undefined : eq(sampleDefects.partNumber, query.part_number),
    query.issue_id === undefined ? undefined : eq(sampleDefects.issueId, query.issue_id),
    query.search === undefined
      ? undefined
      : or(
          like(sampleDefects.businessId, `%${query.search}%`),
          like(sampleDefects.publicId, `%${query.search}%`),
          like(sampleDefects.batchId, `%${query.search}%`),
          like(sampleDefects.notificationNumber, `%${query.search}%`),
          like(sampleDefects.modelName, `%${query.search}%`),
          like(sampleDefects.serialNumber, `%${query.search}%`),
          like(sampleDefects.cabang, `%${query.search}%`),
          like(sampleDefects.partNumber, `%${query.search}%`),
          like(sampleDefects.partName, `%${query.search}%`),
          like(sampleDefects.kerusakanCabang, `%${query.search}%`)
        )
  )
}

export function createSampleDefectRepository(
  config: SampleDefectRepositoryConfig
) {
  async function create(input: CreateSampleDefectInput): Promise<SampleDefect> {
    const [created] = await config.db.insert(sampleDefects).values(input).returning()

    if (!created) {
      throw new Error('Sample Defect gagal dibuat.')
    }

    return created
  }

  async function findById(id: number): Promise<SampleDefect | undefined> {
    const [sample] = await config.db
      .select()
      .from(sampleDefects)
      .where(eq(sampleDefects.id, id))
      .limit(1)

    return sample
  }

  async function findByPublicId(publicId: string): Promise<SampleDefect | undefined> {
    const [sample] = await config.db
      .select()
      .from(sampleDefects)
      .where(eq(sampleDefects.publicId, publicId))
      .limit(1)

    return sample
  }

  async function findDetailById(id: number): Promise<SampleDefectWithAttachments | undefined> {
    const sample = await findById(id)

    if (!sample) {
      return undefined
    }

    const sampleAttachments = await config.db
      .select()
      .from(attachments)
      .where(eq(attachments.sampleId, id))
      .orderBy(asc(attachments.id))

    return {
      ...sample,
      attachments: sampleAttachments
    }
  }

  async function findByBatchId(batchId: string): Promise<SampleDefect[]> {
    return config.db
      .select()
      .from(sampleDefects)
      .where(eq(sampleDefects.batchId, batchId))
      .orderBy(asc(sampleDefects.id))
  }

  async function list(query: SampleDefectPagination): Promise<PaginatedResponse<SampleDefect>> {
    const where = buildListConditions(query)
    const sort = resolveSort<
      SampleDefectSortField,
      (typeof sampleDefectSortFields)[SampleDefectSortField]
    >(query, sampleDefectSortFields, 'createdAt', 'desc')
    const orderBy = sort.sortDirection === 'desc' ? desc(sort.value) : asc(sort.value)
    const offset = getPaginationOffset(query)

    const [items, countRows] = await Promise.all([
      config.db
        .select()
        .from(sampleDefects)
        .where(where)
        .orderBy(orderBy, asc(sampleDefects.id))
        .limit(query.limit)
        .offset(offset),
      config.db.select({ total: count() }).from(sampleDefects).where(where)
    ])

    return createPaginatedResponse(items, countRows[0]?.total ?? 0, query)
  }

  async function update(
    id: number,
    input: UpdateSampleDefectInput
  ): Promise<SampleDefect | undefined> {
    const [updated] = await config.db
      .update(sampleDefects)
      .set(input)
      .where(eq(sampleDefects.id, id))
      .returning()

    return updated
  }

  async function hardDelete(id: number): Promise<SampleDefect | undefined> {
    const [deleted] = await config.db
      .delete(sampleDefects)
      .where(eq(sampleDefects.id, id))
      .returning()

    return deleted
  }

  return {
    create,
    findById,
    findByPublicId,
    findDetailById,
    findByBatchId,
    list,
    update,
    hardDelete
  }
}
