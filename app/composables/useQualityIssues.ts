import {
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_DEFAULT_PAGE_SIZE,
  PAGINATION_MAX_PAGE_SIZE,
  QUALITY_ISSUE_STATUSES,
  SORT_DIRECTION,
  type PaginatedResponse,
  type QualityIssueStatus,
  type SortDirection
} from '#shared'
import type { LocationQueryValue } from 'vue-router'

export const QUALITY_ISSUE_SORT_FIELDS = [
  'issueName',
  'modelName',
  'serialNumber',
  'tanggalKejadian',
  'notificationNumber',
  'status',
  'createdAt'
] as const

export type QualityIssueSortField = (typeof QUALITY_ISSUE_SORT_FIELDS)[number]

export interface QualityIssueListItem {
  id: number
  issueName: string
  modelName: string
  serialNumber: string
  tanggalKejadian: string
  notificationNumber: string | null
  status: QualityIssueStatus
}

export type QualityIssueListResponse = PaginatedResponse<QualityIssueListItem>

function queryValue(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  const current = Array.isArray(value) ? value[0] : value
  return current ?? undefined
}

function positiveQueryNumber(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
  fallback: number
) {
  const parsed = Number(queryValue(value))
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= PAGINATION_MAX_PAGE_SIZE
    ? parsed
    : fallback
}

function validStatus(value: string | undefined): QualityIssueStatus | undefined {
  return value && (QUALITY_ISSUE_STATUSES as readonly string[]).includes(value)
    ? (value as QualityIssueStatus)
    : undefined
}

function validSortField(value: string | undefined): QualityIssueSortField | undefined {
  return value && QUALITY_ISSUE_SORT_FIELDS.includes(value as QualityIssueSortField)
    ? (value as QualityIssueSortField)
    : undefined
}

function validSortDirection(value: string | undefined): SortDirection | undefined {
  return value === SORT_DIRECTION.ASC || value === SORT_DIRECTION.DESC ? value : undefined
}

export function useQualityIssues() {
  const route = useRoute()
  const router = useRouter()

  const query = computed(() => {
    const search = queryValue(route.query.search)?.trim() || undefined
    const status = validStatus(queryValue(route.query.status))
    const sortBy = validSortField(queryValue(route.query.sortBy))
    const sortDirection = validSortDirection(queryValue(route.query.sortDirection))

    return {
      page: positiveQueryNumber(route.query.page, PAGINATION_DEFAULT_PAGE),
      limit: positiveQueryNumber(route.query.limit, PAGINATION_DEFAULT_PAGE_SIZE),
      search,
      status,
      sortBy,
      sortDirection
    }
  })

  const requestQuery = computed(() => {
    const current = query.value

    return {
      page: current.page,
      limit: current.limit,
      ...(current.search ? { search: current.search } : {}),
      ...(current.status ? { status: current.status } : {}),
      ...(current.sortBy ? { sortBy: current.sortBy } : {}),
      ...(current.sortDirection ? { sortDirection: current.sortDirection } : {})
    }
  })

  const fetchResult = useFetch<QualityIssueListResponse>('/api/quality-issues', {
    query: requestQuery,
    lazy: true,
    default: () => ({
      items: [],
      meta: {
        page: PAGINATION_DEFAULT_PAGE,
        limit: PAGINATION_DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0
      }
    })
  })

  async function updateQuery(changes: Partial<typeof query.value>) {
    const next = { ...query.value, ...changes }
    const nextQuery: Record<string, string> = {}

    if (next.search?.trim()) nextQuery.search = next.search.trim()
    if (next.status) nextQuery.status = next.status
    if (next.sortBy) nextQuery.sortBy = next.sortBy
    if (next.sortDirection) nextQuery.sortDirection = next.sortDirection
    if (next.page > PAGINATION_DEFAULT_PAGE) nextQuery.page = String(next.page)
    if (next.limit !== PAGINATION_DEFAULT_PAGE_SIZE) nextQuery.limit = String(next.limit)

    await router.replace({ query: nextQuery })
  }

  return {
    ...fetchResult,
    query,
    updateQuery
  }
}
