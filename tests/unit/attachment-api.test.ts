import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  parseAttachmentId,
  parseAttachmentPublicId
} from '../../server/utils/attachment-validation'

describe('attachment API boundary', () => {
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

  it('parses positive attachment IDs', () => {
    expect(parseAttachmentId('42')).toBe(42)
  })

  it('rejects malformed attachment IDs', () => {
    expect(() => parseAttachmentId(undefined)).toThrow('ID attachment tidak valid.')
    expect(() => parseAttachmentId('0')).toThrow('ID attachment tidak valid.')
    expect(() => parseAttachmentId('1.5')).toThrow('ID attachment tidak valid.')
    expect(() => parseAttachmentId('../1')).toThrow('ID attachment tidak valid.')
  })

  it('accepts an opaque attachment public ID', () => {
    expect(parseAttachmentPublicId('ATT-00000000-0000-7000-8000-000000000000'))
      .toBe('ATT-00000000-0000-7000-8000-000000000000')
  })

  it('rejects numeric IDs for attachment links', () => {
    expect(() => parseAttachmentPublicId('1'))
      .toThrow('Public ID attachment tidak valid.')
  })
})
