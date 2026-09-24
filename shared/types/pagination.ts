import type { SortDirection } from '../constants'

export interface PaginationQuery<SortField extends string = string> {
  page?: number
  limit?: number
  search?: string
  sortBy?: SortField
  sortDirection?: SortDirection
}

export interface NormalizedPaginationQuery<SortField extends string = string> {
  page: number
  limit: number
  search?: string
  sortBy?: SortField
  sortDirection?: SortDirection
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  items: T[]
  meta: PaginationMeta
}
