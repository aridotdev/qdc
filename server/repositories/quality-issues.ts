import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, lte, or } from 'drizzle-orm'
import type { PaginatedResponse } from '../../shared/types'
import type { QualityIssuePagination } from '../../shared/validators/quality-issues'
import type { createDatabase } from '../database/client'
import {
  attachments,
  qualityIssueDetails,
  qualityIssues,
  type Attachment,
  type QualityIssue,
  type QualityIssueDetail
} from '../database/schema'
import { createPaginatedResponse, getPaginationOffset, resolveSort } from '../utils/pagination'

type QualityIssueDatabase = Pick<
  Awaited<ReturnType<typeof createDatabase>>['db'],
  'select' | 'insert' | 'update' | 'delete'
>
type QualityIssueSortField = keyof typeof qualityIssueSortFields

export type CreateQualityIssueInput = typeof qualityIssues.$inferInsert
export type CreateQualityIssueDetailInput = typeof qualityIssueDetails.$inferInsert
export type UpdateQualityIssueInput = Partial<
  Omit<QualityIssue, 'id' | 'publicId' | 'createdAt' | 'createdByUserId'>
>

export interface QualityIssueRepositoryConfig {
  db: QualityIssueDatabase
}

export interface QualityIssueWithDetails extends QualityIssue {
  details: QualityIssueDetailWithAttachments[]
}

export interface QualityIssueDetailWithAttachments extends QualityIssueDetail {
  attachments: Attachment[]
}

const qualityIssueSortFields = {
  issueName: qualityIssues.issueName,
  modelName: qualityIssues.modelName,
  serialNumber: qualityIssues.serialNumber,
  tanggalKejadian: qualityIssues.tanggalKejadian,
  notificationNumber: qualityIssues.notificationNumber,
  status: qualityIssues.status,
  createdAt: qualityIssues.createdAt
} as const

function buildVisibilityCondition(view: QualityIssuePagination['view']) {
  if (view === 'active') {
    return isNull(qualityIssues.deletedAt)
  }

  if (view === 'deleted') {
    return isNotNull(qualityIssues.deletedAt)
  }

  return undefined
}

function buildListConditions(query: QualityIssuePagination) {
  return and(
    buildVisibilityCondition(query.view),
    query.id === undefined ? undefined : eq(qualityIssues.id, query.id),
    query.issue_id === undefined ? undefined : eq(qualityIssues.id, query.issue_id),
    query.status === undefined ? undefined : eq(qualityIssues.status, query.status),
    query.notification_number === undefined
      ? undefined
      : eq(qualityIssues.notificationNumber, query.notification_number),
    query.model_name === undefined ? undefined : eq(qualityIssues.modelName, query.model_name),
    query.tanggal_kejadian_from === undefined
      ? undefined
      : gte(qualityIssues.tanggalKejadian, query.tanggal_kejadian_from),
    query.tanggal_kejadian_to === undefined
      ? undefined
      : lte(qualityIssues.tanggalKejadian, query.tanggal_kejadian_to),
    query.search === undefined
      ? undefined
      : or(
          like(qualityIssues.businessId, `%${query.search}%`),
          like(qualityIssues.issueName, `%${query.search}%`),
          like(qualityIssues.modelName, `%${query.search}%`),
          like(qualityIssues.serialNumber, `%${query.search}%`),
          like(qualityIssues.notificationNumber, `%${query.search}%`),
          like(qualityIssues.detail, `%${query.search}%`),
          like(qualityIssues.keterangan, `%${query.search}%`)
        )
  )
}

export function createQualityIssueRepository(config: QualityIssueRepositoryConfig) {
  async function create(input: CreateQualityIssueInput): Promise<QualityIssue> {
    const [created] = await config.db.insert(qualityIssues).values(input).returning()

    if (!created) {
      throw new Error('Quality Issue gagal dibuat.')
    }

    return created
  }

  async function findById(
    id: number,
    options: { includeDeleted?: boolean } = {}
  ): Promise<QualityIssue | undefined> {
    const [issue] = await config.db
      .select()
      .from(qualityIssues)
      .where(and(
        eq(qualityIssues.id, id),
        options.includeDeleted ? undefined : isNull(qualityIssues.deletedAt)
      ))
      .limit(1)

    return issue
  }

  async function findByPublicId(
    publicId: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<QualityIssue | undefined> {
    const [issue] = await config.db
      .select()
      .from(qualityIssues)
      .where(and(
        eq(qualityIssues.publicId, publicId),
        options.includeDeleted ? undefined : isNull(qualityIssues.deletedAt)
      ))
      .limit(1)

    return issue
  }

  async function findDetailById(
    id: number,
    options: { includeDeleted?: boolean } = {}
  ): Promise<QualityIssueWithDetails | undefined> {
    const issue = await findById(id, options)

    if (!issue) {
      return undefined
    }

    const details = await config.db
      .select()
      .from(qualityIssueDetails)
      .where(eq(qualityIssueDetails.issueId, id))
      .orderBy(asc(qualityIssueDetails.tanggal), asc(qualityIssueDetails.id))

    const detailIds = details.map(detail => detail.id)
    const attachmentRows = detailIds.length === 0
      ? []
      : await config.db
          .select()
          .from(attachments)
          .where(inArray(attachments.detailId, detailIds))
          .orderBy(asc(attachments.id))
    const attachmentsByDetail = new Map<number, Attachment[]>()

    for (const attachment of attachmentRows) {
      if (attachment.detailId === null) {
        continue
      }

      const current = attachmentsByDetail.get(attachment.detailId) ?? []
      current.push(attachment)
      attachmentsByDetail.set(attachment.detailId, current)
    }

    return {
      ...issue,
      details: details.map(detail => ({
        ...detail,
        attachments: attachmentsByDetail.get(detail.id) ?? []
      }))
    }
  }

  async function createDetail(input: CreateQualityIssueDetailInput): Promise<QualityIssueDetail> {
    const [created] = await config.db.insert(qualityIssueDetails).values(input).returning()

    if (!created) {
      throw new Error('Quality Issue detail gagal dibuat.')
    }

    return created
  }

  async function updateDetail(
    id: number,
    input: Partial<Pick<QualityIssueDetail, 'action' | 'remark' | 'updatedAt' | 'updatedByUserId'>>
  ): Promise<QualityIssueDetail | undefined> {
    const [updated] = await config.db
      .update(qualityIssueDetails)
      .set(input)
      .where(eq(qualityIssueDetails.id, id))
      .returning()

    return updated
  }

  async function deleteDetailById(id: number): Promise<QualityIssueDetail | undefined> {
    const [deleted] = await config.db
      .delete(qualityIssueDetails)
      .where(eq(qualityIssueDetails.id, id))
      .returning()

    return deleted
  }

  async function list(query: QualityIssuePagination): Promise<PaginatedResponse<QualityIssue>> {
    const where = buildListConditions(query)
    const sort = resolveSort<
      QualityIssueSortField,
      (typeof qualityIssueSortFields)[QualityIssueSortField]
    >(query, qualityIssueSortFields, 'createdAt', 'desc')
    const orderBy = sort.sortDirection === 'desc' ? desc(sort.value) : asc(sort.value)
    const offset = getPaginationOffset(query)

    const [items, countRows] = await Promise.all([
      config.db
        .select()
        .from(qualityIssues)
        .where(where)
        .orderBy(orderBy, asc(qualityIssues.id))
        .limit(query.limit)
        .offset(offset),
      config.db.select({ total: count() }).from(qualityIssues).where(where)
    ])

    return createPaginatedResponse(items, countRows[0]?.total ?? 0, query)
  }

  async function update(
    id: number,
    input: UpdateQualityIssueInput
  ): Promise<QualityIssue | undefined> {
    const [updated] = await config.db
      .update(qualityIssues)
      .set(input)
      .where(and(eq(qualityIssues.id, id), isNull(qualityIssues.deletedAt)))
      .returning()

    return updated
  }

  async function softDelete(
    id: number,
    input: Pick<
      QualityIssue,
      'deletedAt' | 'deletedByUserId' | 'deletionReason' | 'updatedAt' | 'updatedByUserId'
    >
  ): Promise<QualityIssue | undefined> {
    const [deleted] = await config.db
      .update(qualityIssues)
      .set(input)
      .where(and(eq(qualityIssues.id, id), isNull(qualityIssues.deletedAt)))
      .returning()

    return deleted
  }

  async function restore(
    id: number,
    updatedAt: string,
    updatedByUserId: string
  ): Promise<QualityIssue | undefined> {
    const [restored] = await config.db
      .update(qualityIssues)
      .set({
        deletedAt: null,
        deletedByUserId: null,
        deletionReason: null,
        updatedAt,
        updatedByUserId
      })
      .where(and(eq(qualityIssues.id, id), isNotNull(qualityIssues.deletedAt)))
      .returning()

    return restored
  }

  async function hardDelete(id: number): Promise<QualityIssue | undefined> {
    const [deleted] = await config.db
      .delete(qualityIssues)
      .where(eq(qualityIssues.id, id))
      .returning()

    return deleted
  }

  return {
    create,
    findById,
    findByPublicId,
    findDetailById,
    createDetail,
    updateDetail,
    list,
    update,
    deleteDetail: deleteDetailById,
    softDelete,
    restore,
    hardDelete
  }
}
