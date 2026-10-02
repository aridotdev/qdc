import { extname } from 'node:path'
import {
  ATTACHMENT_FILE_EXTENSION,
  ATTACHMENT_MIME_TYPE,
  ATTACHMENT_SIZE_LIMIT_BYTES,
  ERROR_CODES,
  type AttachmentFileExtension,
  type AttachmentMimeType
} from '../../shared/constants'

interface FilePolicy {
  mimeType: AttachmentMimeType
  maxSize: number
}

export interface AttachmentFileInput {
  fileName: string
  mimeType: string
  fileSize: number
}

export interface ValidatedAttachmentFile {
  fileName: string
  fileExtension: AttachmentFileExtension
  fileType: AttachmentMimeType
  fileSize: number
  maxSize: number
}

export class UnsupportedFileTypeError extends Error {
  readonly code = ERROR_CODES.UNSUPPORTED_FILE_TYPE

  constructor() {
    super('Extension dan MIME file tidak didukung atau tidak cocok.')
    this.name = 'UnsupportedFileTypeError'
  }
}

export class FileTooLargeError extends Error {
  readonly code = ERROR_CODES.FILE_TOO_LARGE
  readonly maxSize: number

  constructor(maxSize: number) {
    super(`Ukuran file melebihi batas ${maxSize} byte.`)
    this.name = 'FileTooLargeError'
    this.maxSize = maxSize
  }
}

export class InvalidFileSizeError extends Error {
  readonly code = ERROR_CODES.VALIDATION_ERROR

  constructor() {
    super('Ukuran file tidak valid.')
    this.name = 'InvalidFileSizeError'
  }
}

const FILE_POLICIES: Record<AttachmentFileExtension, FilePolicy> = {
  [ATTACHMENT_FILE_EXTENSION.JPG]: {
    mimeType: ATTACHMENT_MIME_TYPE.JPG,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  [ATTACHMENT_FILE_EXTENSION.JPEG]: {
    mimeType: ATTACHMENT_MIME_TYPE.JPEG,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  [ATTACHMENT_FILE_EXTENSION.PNG]: {
    mimeType: ATTACHMENT_MIME_TYPE.PNG,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  [ATTACHMENT_FILE_EXTENSION.PDF]: {
    mimeType: ATTACHMENT_MIME_TYPE.PDF,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  [ATTACHMENT_FILE_EXTENSION.DOCX]: {
    mimeType: ATTACHMENT_MIME_TYPE.DOCX,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  [ATTACHMENT_FILE_EXTENSION.XLSX]: {
    mimeType: ATTACHMENT_MIME_TYPE.XLSX,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  [ATTACHMENT_FILE_EXTENSION.MP4]: {
    mimeType: ATTACHMENT_MIME_TYPE.MP4,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.VIDEO
  }
}

function getFileExtension(fileName: string): string {
  return extname(fileName.replaceAll('\\', '/')).slice(1).toLowerCase()
}

function getFilePolicy(extension: string, mimeType: string): {
  extension: AttachmentFileExtension
  policy: FilePolicy
} {
  const policy = FILE_POLICIES[extension as AttachmentFileExtension]

  if (!policy || policy.mimeType !== mimeType) {
    throw new UnsupportedFileTypeError()
  }

  return {
    extension: extension as AttachmentFileExtension,
    policy
  }
}

export function validateAttachmentFile(input: AttachmentFileInput): ValidatedAttachmentFile {
  const fileName = input.fileName.trim()
  const mimeType = input.mimeType.trim().toLowerCase()

  if (!fileName) {
    throw new UnsupportedFileTypeError()
  }

  if (!Number.isInteger(input.fileSize) || input.fileSize < 0) {
    throw new InvalidFileSizeError()
  }

  const extension = getFileExtension(fileName)
  const { extension: fileExtension, policy } = getFilePolicy(extension, mimeType)

  if (input.fileSize > policy.maxSize) {
    throw new FileTooLargeError(policy.maxSize)
  }

  return {
    fileName,
    fileExtension,
    fileType: policy.mimeType,
    fileSize: input.fileSize,
    maxSize: policy.maxSize
  }
}

export function assertValidAttachmentFile(input: AttachmentFileInput): void {
  validateAttachmentFile(input)
}
