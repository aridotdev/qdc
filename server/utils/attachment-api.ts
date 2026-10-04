import { useRuntimeConfig } from '#imports'
import { createFileStorage } from '../services/file-storage'
import {
  createAttachmentService
} from '../services/attachments'
import { getAuthActor } from '../lib/auth-http'
import db from '../database'
import { createApiError, toApiError } from './api-error'
import { ERROR_CODES } from '../../shared/constants'

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
  throw toApiError(error)
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
    throw createApiError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Owner attachment tidak ditemukan.'
    })
  }

  const parts = await readMultipartFormData(event)
  const files = parts?.filter(part => part.name === 'file' && part.filename) ?? []

  if (files.length !== 1) {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Satu file dengan field "file" wajib dikirim.'
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
