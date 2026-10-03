import { requireAdmin } from '../../lib/auth-policy'
import { getAuthActor } from '../../lib/auth-http'
import { AttachmentNotFoundError } from '../../services/attachments'
import { createRuntimeAttachmentService } from '../../utils/attachment-api'
import { parseAttachmentId } from '../../utils/attachment-validation'

export default eventHandler(async (event) => {
  const actor = getAuthActor(event)
  requireAdmin(actor)

  const id = parseAttachmentId(getRouterParam(event, 'id'))
  const service = createRuntimeAttachmentService()

  try {
    await service.deleteAttachment(id, {
      actorUserId: actor.userId
    })

    return {
      success: true
    }
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Attachment tidak ditemukan.'
      })
    }

    throw error
  }
})
