import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  PAGINATION_MAX_PAGE_SIZE,
  SORT_DIRECTION,
  qualityIssuePaginationSchema
} from '#shared'
import {
  createPaginatedResponse,
  getPaginationOffset,
  resolveSort
} from '../../server/utils/pagination'

describe('pagination utilities', () => {
  const originalCreateError = globalThis.createError

  beforeAll(() => {
    globalThis.createError = ((input: {
      statusCode: number
      statusMessage: string
      message: string
      data?: unknown
      cause?: unknown
    }) => Object.assign(new Error(input.message), input)) as typeof globalThis.createError
  })

  afterAll(() => {
    globalThis.createError = originalCreateError
  })

  it('normalizes query defaults and rejects invalid pagination boundaries', () => {
    expect(qualityIssuePaginationSchema.parse({})).toMatchObject({
      page: 1,
      limit: 20
    })

    expect(() => qualityIssuePaginationSchema.parse({ page: '0' })).toThrow()
    expect(() =>
      qualityIssuePaginationSchema.parse({ limit: String(PAGINATION_MAX_PAGE_SIZE + 1) })
    ).toThrow()
  })

  it('calculates first and last page metadata', () => {
    const firstPage = createPaginatedResponse([{ id: 1 }, { id: 2 }], 5, {
      page: 1,
      limit: 2
    })
    const lastPage = createPaginatedResponse([{ id: 5 }], 5, {
      page: 3,
      limit: 2
    })

    expect(getPaginationOffset({ page: 1, limit: 2 })).toBe(0)
    expect(getPaginationOffset({ page: 3, limit: 2 })).toBe(4)
    expect(firstPage.meta).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3
    })
    expect(lastPage.meta).toEqual({
      page: 3,
      limit: 2,
      total: 5,
      totalPages: 3
    })
  })

  it('returns empty result metadata without forcing a fake page count', () => {
    expect(createPaginatedResponse([], 0, { page: 1, limit: 20 })).toEqual({
      items: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    })
  })

  it('resolves sort only from a repository whitelist', () => {
    const sortFields = {
      createdAt: 'created_at',
      issueName: 'issue_name'
    } as const

    expect(
      resolveSort(
        { sortBy: 'issueName', sortDirection: SORT_DIRECTION.DESC },
        sortFields,
        'createdAt'
      )
    ).toEqual({
      sortBy: 'issueName',
      sortDirection: 'desc',
      value: 'issue_name'
    })
    expect(resolveSort({}, sortFields, 'createdAt')).toEqual({
      sortBy: 'createdAt',
      sortDirection: 'asc',
      value: 'created_at'
    })

    expect(() => resolveSort({ sortBy: 'unsafe_sql' }, sortFields, 'createdAt')).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        data: {
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Input tidak valid.',
            fieldErrors: {
              sortBy: ['Sort field tidak didukung: unsafe_sql.']
            }
          }
        }
      })
    )
  })
})
