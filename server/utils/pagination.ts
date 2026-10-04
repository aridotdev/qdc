import {
  ERROR_CODES,
  SORT_DIRECTION,
  type NormalizedPaginationQuery,
  type PaginatedResponse,
  type PaginationMeta,
  type PaginationQuery,
  type SortDirection
} from '../../shared'
import { createApiError } from './api-error'

type SortInput = Pick<PaginationQuery<string>, 'sortBy' | 'sortDirection'>

export interface ResolvedSort<SortField extends string, SortValue> {
  sortBy: SortField
  sortDirection: SortDirection
  value: SortValue
}

function hasSortField<SortField extends string, SortValue>(
  whitelist: Readonly<Record<SortField, SortValue>>,
  sortBy: string
): sortBy is SortField {
  return Object.prototype.hasOwnProperty.call(whitelist, sortBy)
}

export function getPaginationOffset(
  query: Pick<NormalizedPaginationQuery, 'page' | 'limit'>
): number {
  return (query.page - 1) * query.limit
}

export function createPaginationMeta(
  query: Pick<NormalizedPaginationQuery, 'page' | 'limit'>,
  total: number
): PaginationMeta {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit)
  }
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  query: Pick<NormalizedPaginationQuery, 'page' | 'limit'>
): PaginatedResponse<T> {
  return {
    items,
    meta: createPaginationMeta(query, total)
  }
}

export function resolveSort<SortField extends string, SortValue>(
  query: SortInput,
  whitelist: Readonly<Record<SortField, SortValue>>,
  fallbackSortBy: SortField,
  fallbackSortDirection: SortDirection = SORT_DIRECTION.ASC
): ResolvedSort<SortField, SortValue> {
  const sortBy = query.sortBy ?? fallbackSortBy

  if (!hasSortField(whitelist, sortBy)) {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      fieldErrors: {
        sortBy: [`Sort field tidak didukung: ${sortBy}.`]
      }
    })
  }

  return {
    sortBy,
    sortDirection: query.sortDirection ?? fallbackSortDirection,
    value: whitelist[sortBy]
  }
}
