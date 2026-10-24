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
    getStorageContext: async () => {
      const [sample] = await db
        .select({
          businessId: sampleDefects.businessId,
          createdAt: sampleDefects.createdAt
        })
        .from(sampleDefects)
        .where(eq(sampleDefects.id, id))
        .limit(1)

      if (!sample?.businessId) {
        return undefined
      }

      return {
        section: 'sample-defect' as const,
        reportYear: new Date(sample.createdAt).getUTCFullYear(),
        businessId: sample.businessId
      }
    }
  })
})
