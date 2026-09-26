import { defineRelations } from 'drizzle-orm'
import { qualityIssues } from './quality-issues'
import { qualityIssueDetails } from './quality-issue-details'
import { sampleDefects } from './sample-defects'
import { technicalReports } from './technical-reports'

export * from './quality-issues'
export * from './quality-issue-details'
export * from './sample-defects'
export * from './technical-reports'

export const schema = {
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
    })
  },
  sampleDefects: {
    issue: r.one.qualityIssues({
      from: r.sampleDefects.issueId,
      to: r.qualityIssues.id
    })
  },
  technicalReports: {
    issue: r.one.qualityIssues({
      from: r.technicalReports.issueId,
      to: r.qualityIssues.id
    })
  }
}))
