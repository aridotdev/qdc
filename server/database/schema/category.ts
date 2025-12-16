import z from 'zod'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema } from 'drizzle-zod'
import { sql } from 'drizzle-orm'

export const category = sqliteTable('category', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => sql`(unixepoch())`)
})

export const InsertCategorySchema = createInsertSchema(category, {
  name: z
    .string()
    .min(1)
    .max(20)
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

export type InsertCategory = z.infer<typeof InsertCategorySchema>
export type SelectCategory = typeof category.$inferSelect
