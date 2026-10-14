import { and, eq, sql } from 'drizzle-orm'
import type { PublicIdEntity } from '../../shared/constants'
import type { createDatabase } from '../database/client'
import { businessIdCounters } from '../database/schema'

type BusinessIdDatabase = Pick<Awaited<ReturnType<typeof createDatabase>>['db'], 'insert' | 'select'>

function businessDate(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '')
}

function assertSequence(sequence: number | undefined): number {
  if (sequence === undefined || sequence < 1) {
    throw new Error('Business ID sequence gagal dibuat.')
  }

  return sequence
}

export function formatBusinessId(entity: PublicIdEntity, date: Date, sequence: number): string {
  return `${entity}-${businessDate(date)}-${String(sequence).padStart(3, '0')}`
}

export async function createBusinessId(
  database: BusinessIdDatabase,
  entity: PublicIdEntity,
  date: Date = new Date()
): Promise<string> {
  const datePart = businessDate(date)

  await database
    .insert(businessIdCounters)
    .values({
      entity,
      businessDate: datePart,
      lastSequence: 1
    })
    .onConflictDoUpdate({
      target: [businessIdCounters.entity, businessIdCounters.businessDate],
      set: {
        lastSequence: sql`${businessIdCounters.lastSequence} + 1`
      }
    })

  const [counter] = await database
    .select({ lastSequence: businessIdCounters.lastSequence })
    .from(businessIdCounters)
    .where(and(
      eq(businessIdCounters.entity, entity),
      eq(businessIdCounters.businessDate, datePart)
    ))
    .limit(1)

  return formatBusinessId(entity, date, assertSequence(counter?.lastSequence))
}
