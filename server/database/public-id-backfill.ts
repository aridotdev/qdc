import { asc, eq, isNull } from 'drizzle-orm'
import type { Client, Transaction } from '@libsql/client'
import type { createDatabase } from './client'
import {
  qualityIssues,
  sampleDefects,
  technicalReports
} from './schema'
import {
  qualityIssuePublicIdSchema,
  sampleDefectPublicIdSchema,
  technicalReportPublicIdSchema
} from '../../shared/validators/public-id'
import { createPublicId } from '../utils/public-id'

type Database = Awaited<ReturnType<typeof createDatabase>>
type DatabaseExecutor = Pick<Database['db'], 'select' | 'update'>

type BackfillResult = {
  qualityIssues: number
  sampleDefects: number
  technicalReports: number
}

type PublicIdTable = {
  tableName: string
  validator: {
    safeParse(value: unknown): { success: boolean }
  }
}

const publicIdTables: PublicIdTable[] = [
  {
    tableName: 'quality_issues',
    validator: qualityIssuePublicIdSchema
  },
  {
    tableName: 'sample_defects',
    validator: sampleDefectPublicIdSchema
  },
  {
    tableName: 'technical_reports',
    validator: technicalReportPublicIdSchema
  }
]

async function fillQualityIssueIds(database: DatabaseExecutor): Promise<number> {
  const rows = await database
    .select({ id: qualityIssues.id })
    .from(qualityIssues)
    .where(isNull(qualityIssues.publicId))
    .orderBy(asc(qualityIssues.id))

  for (const row of rows) {
    await database
      .update(qualityIssues)
      .set({ publicId: createPublicId('QI') })
      .where(eq(qualityIssues.id, row.id))
  }

  return rows.length
}

async function fillSampleDefectIds(database: DatabaseExecutor): Promise<number> {
  const rows = await database
    .select({ id: sampleDefects.id })
    .from(sampleDefects)
    .where(isNull(sampleDefects.publicId))
    .orderBy(asc(sampleDefects.id))

  for (const row of rows) {
    await database
      .update(sampleDefects)
      .set({ publicId: createPublicId('SD') })
      .where(eq(sampleDefects.id, row.id))
  }

  return rows.length
}

async function fillTechnicalReportIds(database: DatabaseExecutor): Promise<number> {
  const rows = await database
    .select({ id: technicalReports.id })
    .from(technicalReports)
    .where(isNull(technicalReports.publicId))
    .orderBy(asc(technicalReports.id))

  for (const row of rows) {
    await database
      .update(technicalReports)
      .set({ publicId: createPublicId('TR') })
      .where(eq(technicalReports.id, row.id))
  }

  return rows.length
}

function getRowValue(row: Record<string, unknown> | undefined, key: string): unknown {
  return row?.[key]
}

async function verifyPublicIds(client: Client): Promise<void> {
  for (const table of publicIdTables) {
    const rows = await client.execute({
      sql: `SELECT id, public_id FROM "${table.tableName}" ORDER BY id`
    })

    for (const row of rows.rows) {
      const publicId = getRowValue(row as Record<string, unknown>, 'public_id')
      if (!table.validator.safeParse(publicId).success) {
        throw new Error(`Public ID tidak valid pada ${table.tableName}, row ${String(getRowValue(row as Record<string, unknown>, 'id'))}.`)
      }
    }

    const duplicates = await client.execute({
      sql: `
        SELECT public_id
        FROM "${table.tableName}"
        GROUP BY public_id
        HAVING COUNT(*) > 1
      `
    })

    if (duplicates.rows.length > 0) {
      throw new Error(`Public ID duplicate pada ${table.tableName}.`)
    }
  }
}

function replaceTableName(createSql: string, tableName: string, replacement: string): string {
  const candidates = [
    [`CREATE TABLE \`${tableName}\``, `CREATE TABLE \`${replacement}\``],
    [`CREATE TABLE "${tableName}"`, `CREATE TABLE "${replacement}"`],
    [`CREATE TABLE ${tableName}`, `CREATE TABLE ${replacement}`]
  ] as const

  for (const [source, target] of candidates) {
    if (createSql.includes(source)) {
      return createSql.replace(source, target)
    }
  }

  throw new Error(`Definisi tabel ${tableName} tidak dikenali.`)
}

async function rebuildTableWithNotNull(
  client: Client,
  tableName: string
): Promise<void> {
  const tableInfo = await client.execute({
    sql: `PRAGMA table_info("${tableName}")`
  })
  const publicIdColumn = tableInfo.rows.find(
    row => getRowValue(row as Record<string, unknown>, 'name') === 'public_id'
  )

  if (getRowValue(publicIdColumn as Record<string, unknown>, 'notnull') === 1) {
    return
  }

  const tableDefinition = await client.execute({
    sql: 'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
    args: ['table', tableName]
  })
  const createSql = getRowValue(
    tableDefinition.rows[0] as Record<string, unknown>,
    'sql'
  )

  if (typeof createSql !== 'string') {
    throw new Error(`Definisi tabel ${tableName} tidak ditemukan.`)
  }

  const indexes = await client.execute({
    sql: `
      SELECT sql
      FROM sqlite_master
      WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL
      ORDER BY name
    `,
    args: [tableName]
  })
  const columns = tableInfo.rows.map(row => `"${String(getRowValue(row as Record<string, unknown>, 'name'))}"`)
  const newTableName = `__public_id_new_${tableName}`
  const newCreateSql = replaceTableName(createSql, tableName, newTableName)
    .replace('`public_id` text', '`public_id` text NOT NULL')
    .replace('"public_id" text', '"public_id" text NOT NULL')

  const transaction: Transaction = await client.transaction('write')

  try {
    await transaction.execute(`DROP TABLE IF EXISTS "${newTableName}"`)
    await transaction.execute(newCreateSql)
    await transaction.execute(
      `INSERT INTO "${newTableName}" (${columns.join(', ')}) SELECT ${columns.join(', ')} FROM "${tableName}"`
    )
    await transaction.execute(`DROP TABLE "${tableName}"`)
    await transaction.execute(`ALTER TABLE "${newTableName}" RENAME TO "${tableName}"`)

    for (const index of indexes.rows) {
      const indexSql = getRowValue(index as Record<string, unknown>, 'sql')
      if (typeof indexSql === 'string') {
        await transaction.execute(indexSql)
      }
    }

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

async function enforcePublicIdNotNull(client: Client): Promise<void> {
  await client.execute('PRAGMA foreign_keys = OFF')

  try {
    await rebuildTableWithNotNull(client, 'sample_defects')
    await rebuildTableWithNotNull(client, 'technical_reports')
    await rebuildTableWithNotNull(client, 'quality_issues')
  } finally {
    await client.execute('PRAGMA foreign_keys = ON')
  }
}

export async function backfillPublicIds(database: Database): Promise<BackfillResult> {
  const result = await database.db.transaction(async transaction => ({
    qualityIssues: await fillQualityIssueIds(transaction),
    sampleDefects: await fillSampleDefectIds(transaction),
    technicalReports: await fillTechnicalReportIds(transaction)
  }))

  await verifyPublicIds(database.client)
  await enforcePublicIdNotNull(database.client)
  await verifyPublicIds(database.client)

  return result
}
