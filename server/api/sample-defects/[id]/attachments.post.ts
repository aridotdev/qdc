import { eq } from 'drizzle-orm'
import { sampleDefects } from '../../../database/schema'
import db from '../../../database'
import { uploadAttachment } from '../../../utils/attachment-api'
import { parseAttachmentId } from '../../../utils/attachment-validation'

export default eventHandler(async (event) => {
  const id = parseAttachmentId(getRouterParam(event, 'id'))

  return uploadAttachment(event, {
    field: 'sampleId',
    id,
    exists: async () => {
      const [sample] = await db
        .select({ id: sampleDefects.id })
        .from(sampleDefects)
        .where(eq(sampleDefects.id, id))
        .limit(1)

      return Boolean(sample)
    }
  })
})
