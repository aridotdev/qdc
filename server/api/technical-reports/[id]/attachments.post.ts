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
    getStorageContext: async () => {
      const [report] = await db
        .select({
          businessId: technicalReports.businessId,
          createdAt: technicalReports.createdAt
        })
        .from(technicalReports)
        .where(eq(technicalReports.id, id))
        .limit(1)

      if (!report?.businessId) {
        return undefined
      }

      return {
        section: 'technical-report' as const,
        reportYear: new Date(report.createdAt).getUTCFullYear(),
        businessId: report.businessId
      }
    }
  })
})
