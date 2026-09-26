import { defineRelations } from 'drizzle-orm'
import { qualityIssues } from './quality-issues'
import { qualityIssueDetails } from './quality-issue-details'
import { sampleDefects } from './sample-defects'

export * from './quality-issues'
export * from './quality-issue-details'
export * from './sample-defects'

export const schema = {
  qualityIssues,
  qualityIssueDetails,
  sampleDefects
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
  }
}))
