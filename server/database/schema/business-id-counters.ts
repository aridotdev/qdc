import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const businessIdCounters = sqliteTable(
  'business_id_counters',
  {
    entity: text('entity').notNull(),
    businessDate: text('business_date').notNull(),
    lastSequence: integer('last_sequence').notNull()
  },
  table => [
    primaryKey({
      name: 'business_id_counters_pk',
      columns: [table.entity, table.businessDate]
    })
  ]
)
