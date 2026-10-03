import { eq } from 'drizzle-orm'
import { technicalReports } from '../../../database/schema'
import db from '../../../database'
import { uploadAttachment } from '../../../utils/attachment-api'
import { parseAttachmentId } from '../../../utils/attachment-validation'

export default eventHandler(async (event) => {
  const id = parseAttachmentId(getRouterParam(event, 'id'))

  return uploadAttachment(event, {
    field: 'reportId',
    id,
    exists: async () => {
      const [report] = await db
        .select({ id: technicalReports.id })
        .from(technicalReports)
        .where(eq(technicalReports.id, id))
        .limit(1)

      return Boolean(report)
    }
  })
})
