import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseQualityIssueIdentifier } from '../../server/utils/quality-issue-validation'

describe('quality issue URL identifier', () => {
  const originalCreateError = globalThis.createError

  beforeAll(() => {
    globalThis.createError = ((input: {
      statusCode: number
      statusMessage: string
    }) => Object.assign(new Error(input.statusMessage), input)) as typeof globalThis.createError
  })

  afterAll(() => {
    globalThis.createError = originalCreateError
  })

  it('accepts legacy numeric IDs', () => {
    expect(parseQualityIssueIdentifier('42')).toEqual({ type: 'numeric', value: 42 })
  })

  it('accepts valid Quality Issue public IDs', () => {
    expect(
      parseQualityIssueIdentifier('QI-00000000-0000-7000-8000-000000000000')
    ).toEqual({
      type: 'public',
      value: 'QI-00000000-0000-7000-8000-000000000000'
    })
  })

  it.each([
    undefined,
    '0',
    '1.5',
    'SD-00000000-0000-7000-8000-000000000000',
    'QI-not-a-uuid'
  ])('rejects invalid identifier %s', (value) => {
    expect(() => parseQualityIssueIdentifier(value)).toThrow(
      'ID atau Public ID Quality Issue tidak valid.'
    )
  })
})
