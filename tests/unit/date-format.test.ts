import { describe, expect, it } from 'vitest'
import { formatIndonesianDate, formatIndonesianDateTime } from '../../app/utils/date'

describe('Indonesian date formatting', () => {
  it('formats business dates as dd-MM-yyyy without timezone shifts', () => {
    expect(formatIndonesianDate('2026-10-03')).toBe('03-10-2026')
  })

  it('formats date-times with the Indonesian date prefix', () => {
    expect(formatIndonesianDateTime('2026-10-03T12:30:00.000Z')).toMatch(/^03-10-2026 \d{2}:\d{2}$/)
  })
})
