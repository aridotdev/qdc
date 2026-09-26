import { defineRelations } from 'drizzle-orm'
import { qualityIssues } from './quality-issues'
import { qualityIssueDetails } from './quality-issue-details'

export * from './quality-issues'
export * from './quality-issue-details'

export const schema = {
  qualityIssues,
  qualityIssueDetails
}

export const relations = defineRelations(schema, r => ({
  qualityIssues: {
    // cascade delete di DB (lihat quality-issue-details.ts)
    details: r.many.qualityIssueDetails({
      from: r.qualityIssues.id,
      to: r.qualityIssueDetails.issueId
    })
  },
  qualityIssueDetails: {
    issue: r.one.qualityIssues({
      from: r.qualityIssueDetails.issueId,
      to: r.qualityIssues.id
    })
  }
}))
