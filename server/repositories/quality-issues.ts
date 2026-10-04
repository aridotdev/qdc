import { and, asc, count, desc, eq, gte, like, lte, or } from 'drizzle-orm'
import type { PaginatedResponse } from '../../shared/types'
import type { QualityIssuePagination } from '../../shared/validators/quality-issues'
import type { createDatabase } from '../database/client'
import {
  qualityIssueDetails,
  qualityIssues,
  type QualityIssue,
  type QualityIssueDetail
} from '../database/schema'
import { createPaginatedResponse, getPaginationOffset, resolveSort } from '../utils/pagination'

type QualityIssueDatabase = Awaited<ReturnType<typeof createDatabase>>['db']
type QualityIssueSortField = keyof typeof qualityIssueSortFields

export type CreateQualityIssueInput = typeof qualityIssues.$inferInsert
export type UpdateQualityIssueInput = Partial<
  Omit<QualityIssue, 'id' | 'createdAt' | 'createdByUserId'>
>

export interface QualityIssueRepositoryConfig {
  db: QualityIssueDatabase
}

export interface QualityIssueWithDetails extends QualityIssue {
  details: QualityIssueDetail[]
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

function buildListConditions(query: QualityIssuePagination) {
  return and(
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

  async function findById(id: number): Promise<QualityIssue | undefined> {
    const [issue] = await config.db
      .select()
      .from(qualityIssues)
      .where(eq(qualityIssues.id, id))
      .limit(1)

    return issue
  }

  async function findDetailById(id: number): Promise<QualityIssueWithDetails | undefined> {
    const issue = await findById(id)

    if (!issue) {
      return undefined
    }

    const details = await config.db
      .select()
      .from(qualityIssueDetails)
      .where(eq(qualityIssueDetails.issueId, id))
      .orderBy(asc(qualityIssueDetails.tanggal), asc(qualityIssueDetails.id))

    return {
      ...issue,
      details
    }
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
      .where(eq(qualityIssues.id, id))
      .returning()

    return updated
  }

  async function deleteById(id: number): Promise<QualityIssue | undefined> {
    const [deleted] = await config.db
      .delete(qualityIssues)
      .where(eq(qualityIssues.id, id))
      .returning()

    return deleted
  }

  return {
    create,
    findById,
    findDetailById,
    list,
    update,
    delete: deleteById
  }
}
