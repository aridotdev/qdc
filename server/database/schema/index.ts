import { defineRelations } from 'drizzle-orm'
import { attachments } from './attachments'
import { auditLogs } from './audit-logs'
import { qualityIssues } from './quality-issues'
import { qualityIssueDetails } from './quality-issue-details'
import { sampleDefects } from './sample-defects'
import { technicalReports } from './technical-reports'

export * from './attachments'
export * from './audit-logs'
export * from './quality-issues'
export * from './quality-issue-details'
export * from './sample-defects'
export * from './technical-reports'

export const schema = {
  attachments,
  auditLogs,
  qualityIssues,
  qualityIssueDetails,
  sampleDefects,
  technicalReports
}

export const relations = defineRelations(schema, r => ({
  qualityIssues: {
    // cascade delete di DB (lihat quality-issue-details.ts)
    details: r.many.qualityIssueDetails({
      from: r.qualityIssues.id,
      to: r.qualityIssueDetails.issueId
    }),
    sampleDefects: r.many.sampleDefects({
      from: r.qualityIssues.id,
      to: r.sampleDefects.issueId
    }),
    technicalReports: r.many.technicalReports({
      from: r.qualityIssues.id,
      to: r.technicalReports.issueId
    })
  },
  qualityIssueDetails: {
    issue: r.one.qualityIssues({
      from: r.qualityIssueDetails.issueId,
      to: r.qualityIssues.id
    }),
    attachments: r.many.attachments({
      from: r.qualityIssueDetails.id,
      to: r.attachments.detailId
    })
  },
  sampleDefects: {
    issue: r.one.qualityIssues({
      from: r.sampleDefects.issueId,
      to: r.qualityIssues.id
    }),
    attachments: r.many.attachments({
      from: r.sampleDefects.id,
      to: r.attachments.sampleId
    })
  },
  technicalReports: {
    issue: r.one.qualityIssues({
      from: r.technicalReports.issueId,
      to: r.qualityIssues.id
    }),
    attachments: r.many.attachments({
      from: r.technicalReports.id,
      to: r.attachments.reportId
    })
  },
  attachments: {
    detail: r.one.qualityIssueDetails({
      from: r.attachments.detailId,
      to: r.qualityIssueDetails.id
    }),
    sample: r.one.sampleDefects({
      from: r.attachments.sampleId,
      to: r.sampleDefects.id
    }),
    report: r.one.technicalReports({
      from: r.attachments.reportId,
      to: r.technicalReports.id
    })
  },
  auditLogs: {}
}))
