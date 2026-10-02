import { describe, expect, it } from 'vitest'
import {
  assertValidAttachmentFile,
  FileTooLargeError,
  InvalidFileSizeError,
  UnsupportedFileTypeError,
  validateAttachmentFile
} from '../../server/services/file-policy'
import {
  ATTACHMENT_SIZE_LIMIT_BYTES,
  type AttachmentFileExtension,
  type AttachmentMimeType
} from '../../shared/constants'

const supportedFiles: Array<{
  extension: AttachmentFileExtension
  mimeType: AttachmentMimeType
}> = [
  { extension: 'jpg', mimeType: 'image/jpeg' },
  { extension: 'jpeg', mimeType: 'image/jpeg' },
  { extension: 'png', mimeType: 'image/png' },
  { extension: 'pdf', mimeType: 'application/pdf' },
  {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  {
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  { extension: 'mp4', mimeType: 'video/mp4' }
]

describe('central file policy validation', () => {
  it.each(supportedFiles)(
    'accepts supported .$extension with matching MIME',
    ({ extension, mimeType }) => {
      const result = validateAttachmentFile({
        fileName: `evidence.${extension}`,
        mimeType,
        fileSize: 1
      })

      expect(result.fileExtension).toBe(extension)
      expect(result.fileType).toBe(mimeType)
    }
  )

  it('normalizes filename and MIME casing', () => {
    const result = validateAttachmentFile({
      fileName: '  evidence.PNG  ',
      mimeType: 'IMAGE/PNG',
      fileSize: 1
    })

    expect(result.fileName).toBe('evidence.PNG')
    expect(result.fileExtension).toBe('png')
    expect(result.fileType).toBe('image/png')
  })

  it('rejects an unsupported extension', () => {
    expect(() => assertValidAttachmentFile({
      fileName: 'evidence.exe',
      mimeType: 'application/octet-stream',
      fileSize: 1
    })).toThrowError(UnsupportedFileTypeError)
  })

  it('rejects a mismatched MIME type', () => {
    expect(() => assertValidAttachmentFile({
      fileName: 'evidence.png',
      mimeType: 'image/jpeg',
      fileSize: 1
    })).toThrowError(UnsupportedFileTypeError)
  })

  it('accepts image/document files at exactly 1 MB', () => {
    expect(() => assertValidAttachmentFile({
      fileName: 'evidence.pdf',
      mimeType: 'application/pdf',
      fileSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
    })).not.toThrow()
  })

  it('accepts video files at exactly 10 MB', () => {
    expect(() => assertValidAttachmentFile({
      fileName: 'evidence.mp4',
      mimeType: 'video/mp4',
      fileSize: ATTACHMENT_SIZE_LIMIT_BYTES.VIDEO
    })).not.toThrow()
  })

  it('rejects image/document files above 1 MB', () => {
    expect(() => assertValidAttachmentFile({
      fileName: 'evidence.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT + 1
    })).toThrowError(FileTooLargeError)
  })

  it('rejects video files above 10 MB', () => {
    expect(() => assertValidAttachmentFile({
      fileName: 'evidence.mp4',
      mimeType: 'video/mp4',
      fileSize: ATTACHMENT_SIZE_LIMIT_BYTES.VIDEO + 1
    })).toThrowError(FileTooLargeError)
  })

  it('rejects invalid file sizes', () => {
    expect(() => assertValidAttachmentFile({
      fileName: 'evidence.png',
      mimeType: 'image/png',
      fileSize: -1
    })).toThrowError(InvalidFileSizeError)
    expect(() => assertValidAttachmentFile({
      fileName: 'evidence.png',
      mimeType: 'image/png',
      fileSize: Number.NaN
    })).toThrowError(InvalidFileSizeError)
  })
})
