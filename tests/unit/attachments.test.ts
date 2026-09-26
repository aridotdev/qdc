import { describe, expect, it } from 'vitest'
import {
  assertExactlyOneAttachmentOwner,
  countAttachmentOwners,
  InvalidAttachmentOwnerError
} from '../../server/services/attachments'

describe('attachment owner invariant', () => {
  it('counts exactly one owner', () => {
    expect(countAttachmentOwners({ detailId: 10 })).toBe(1)
    expect(countAttachmentOwners({ sampleId: 20 })).toBe(1)
    expect(countAttachmentOwners({ reportId: 30 })).toBe(1)
  })

  it('rejects an attachment without an owner', () => {
    expect(() => assertExactlyOneAttachmentOwner({})).toThrowError(InvalidAttachmentOwnerError)
    expect(() =>
      assertExactlyOneAttachmentOwner({
        detailId: null,
        sampleId: null,
        reportId: null
      })
    ).toThrow('tepat satu owner')
  })

  it('rejects an attachment with multiple owners', () => {
    expect(() =>
      assertExactlyOneAttachmentOwner({
        detailId: 10,
        sampleId: 20
      })
    ).toThrowError(InvalidAttachmentOwnerError)
    expect(() =>
      assertExactlyOneAttachmentOwner({
        detailId: 10,
        sampleId: 20,
        reportId: 30
      })
    ).toThrow('tepat satu owner')
  })
})
