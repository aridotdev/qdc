import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createRuntimeAttachmentService } from '../../utils/attachment-api'
import { parseAttachmentId } from '../../utils/attachment-validation'
import { AttachmentNotFoundError } from '../../services/attachments'
import { getAuthActor } from '../../lib/auth-http'

export default eventHandler(async (event) => {
  getAuthActor(event)

  const id = parseAttachmentId(getRouterParam(event, 'id'))
  const service = createRuntimeAttachmentService()
  let attachment

  try {
    attachment = await service.getAttachment(id)
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Attachment tidak ditemukan.'
      })
    }

    throw error
  }

  const storage = service.storage

  try {
    await stat(storage.resolvePath(attachment.storageName))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        statusMessage: 'File attachment tidak ditemukan.'
      })
    }

    throw error
  }

  setResponseHeader(event, 'content-type', attachment.fileType)
  setResponseHeader(event, 'content-length', attachment.fileSize)
  setResponseHeader(
    event,
    'content-disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`
  )

  return sendStream(event, createReadStream(storage.resolvePath(attachment.storageName)))
})
