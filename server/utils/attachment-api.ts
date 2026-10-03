import { useRuntimeConfig } from '#imports'
import { createFileStorage } from '../services/file-storage'
import {
  createAttachmentService,
  InvalidAttachmentOwnerError
} from '../services/attachments'
import {
  FileTooLargeError,
  InvalidFileSizeError,
  UnsupportedFileTypeError
} from '../services/file-policy'
import { getAuthActor } from '../lib/auth-http'
import db from '../database'

export type AttachmentOwnerField = 'detailId' | 'sampleId' | 'reportId'

export function createRuntimeAttachmentService() {
  const config = useRuntimeConfig()

  return createAttachmentService({
    db,
    storage: createFileStorage({
      rootDir: config.storageRoot
    })
  })
}

export function mapAttachmentInputError(error: unknown): never {
  if (
    error instanceof UnsupportedFileTypeError
    || error instanceof FileTooLargeError
    || error instanceof InvalidFileSizeError
    || error instanceof InvalidAttachmentOwnerError
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message
    })
  }

  throw error
}

export async function uploadAttachment(
  event: Parameters<Parameters<typeof eventHandler>[0]>[0],
  owner: {
    field: AttachmentOwnerField
    id: number
    exists: () => Promise<boolean>
  }
) {
  if (!await owner.exists()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Owner attachment tidak ditemukan.'
    })
  }

  const parts = await readMultipartFormData(event)
  const files = parts?.filter(part => part.name === 'file' && part.filename) ?? []

  if (files.length !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Satu file dengan field "file" wajib dikirim.'
    })
  }

  const file = files[0]!
  const actor = getAuthActor(event)
  const service = createRuntimeAttachmentService()

  try {
    const attachment = await service.createAttachment({
      [owner.field]: owner.id,
      fileName: file.filename!,
      mimeType: file.type ?? '',
      data: file.data
    }, {
      actorUserId: actor.userId
    })

    setResponseStatus(event, 201)
    return attachment
  } catch (error) {
    return mapAttachmentInputError(error)
  }
}
