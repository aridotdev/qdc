import z from 'zod'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema } from 'drizzle-zod'
import { sql } from 'drizzle-orm'
import type { SelectCategory } from './category'
import { category } from './category'

export const monitoring = sqliteTable('monitoring', {
  id: integer().primaryKey({ autoIncrement: true }),
  month: text().notNull(),
  fiscal: text().notNull(),
  total: integer().notNull(),
  ok: integer().notNull(),
  ng: integer().notNull(),
  categoryId: integer()
    .notNull()
    .references(() => category.id),
  createdAt: text()
    .notNull()
    .default(sql`(datetime('now', 'localtime'))`),
  updatedAt: text()
    .notNull()
    .default(sql`(datetime('now', 'localtime'))`)
    .$onUpdateFn(() => sql`(datetime('now', 'localtime'))`)
})

export const InsertMonitoringSchema = createInsertSchema(monitoring, {
  month: z.string().min(1).max(15),
  fiscal: z.string().min(1).max(15),
  total: z.number().int().nonnegative(),
  ok: z.number().int().nonnegative(),
  ng: z.number().int().nonnegative(),
  categoryId: z.number().int().nonnegative()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

export type InsertMonitoring = z.infer<typeof InsertMonitoringSchema>
export type SelectMonitoring = typeof monitoring.$inferSelect
export type MonitoringWithCategory = SelectMonitoring & {
  category: SelectCategory
}
