import { ERROR_CODES } from '../../shared/constants'

export interface AttachmentOwnerInput {
  detailId?: number | null
  sampleId?: number | null
  reportId?: number | null
}

export class InvalidAttachmentOwnerError extends Error {
  readonly code = ERROR_CODES.INVALID_ATTACHMENT_OWNER

  constructor() {
    super('Attachment harus memiliki tepat satu owner.')
    this.name = 'InvalidAttachmentOwnerError'
  }
}

export function countAttachmentOwners(owner: AttachmentOwnerInput): number {
  return [owner.detailId, owner.sampleId, owner.reportId].filter(
    value => value !== null && value !== undefined
  ).length
}

export function assertExactlyOneAttachmentOwner(owner: AttachmentOwnerInput): void {
  if (countAttachmentOwners(owner) !== 1) {
    throw new InvalidAttachmentOwnerError()
  }
}
