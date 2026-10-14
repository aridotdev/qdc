import { describe, expect, it } from 'vitest'
import { formatBusinessId } from '../../server/utils/business-id'

describe('business ID formatting', () => {
  it('formats entity, UTC date, and three digit sequence', () => {
    const date = new Date('2026-10-14T07:30:00.000Z')

    expect(formatBusinessId('QI', date, 1)).toBe('QI-20261014-001')
    expect(formatBusinessId('SD', date, 12)).toBe('SD-20261014-012')
    expect(formatBusinessId('TR', date, 123)).toBe('TR-20261014-123')
  })
})
