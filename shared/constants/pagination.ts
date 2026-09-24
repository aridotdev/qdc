export const PAGINATION_DEFAULT_PAGE = 1
export const PAGINATION_DEFAULT_PAGE_SIZE = 20

export const SORT_DIRECTION = {
  ASC: 'asc',
  DESC: 'desc'
} as const

export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION]
