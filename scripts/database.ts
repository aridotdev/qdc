import 'dotenv/config'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, resolve } from 'node:path'
import { createDatabase } from '../server/database/client'
import { migrateDatabase } from '../server/database/migrate'
import { seedAdminAccount, seedDatabase } from '../server/database/seed'

const defaultDatabaseUrl = 'file:.data/qdc-local.db'

function getDatabaseUrl(): string {
  return process.env.DB_FILE_NAME ?? process.env.NUXT_DB_FILE_NAME ?? defaultDatabaseUrl
}

function getLocalDatabasePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error('Database lifecycle command hanya mendukung SQLite file URL.')
  }

  const rawPath = databaseUrl.slice('file:'.length).split(/[?#]/, 1)[0]

  if (rawPath.startsWith('//')) {
    return fileURLToPath(new URL(databaseUrl))
  }

  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath)
}

async function removeDatabaseFiles(databaseUrl: string): Promise<void> {
  const databasePath = getLocalDatabasePath(databaseUrl)

  await Promise.all([
    rm(databasePath, { force: true }),
    rm(`${databasePath}-wal`, { force: true }),
    rm(`${databasePath}-shm`, { force: true }),
    rm(`${databasePath}-journal`, { force: true })
  ])
}

async function openDatabase(databaseUrl: string) {
  const databasePath = getLocalDatabasePath(databaseUrl)
  await mkdir(dirname(databasePath), { recursive: true })
  return createDatabase(databaseUrl)
}

async function runMigrate(databaseUrl: string): Promise<void> {
  const database = await openDatabase(databaseUrl)

  try {
    await migrateDatabase(database)
  } finally {
    database.client.close()
  }
}

async function runSeed(databaseUrl: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed tidak boleh dijalankan pada production.')
  }

  const database = await openDatabase(databaseUrl)

  try {
    await migrateDatabase(database)
    const result = await seedDatabase(database.db)
    console.log(
      result.seeded
        ? `Development seed completed. Admin email: ${process.env.SEED_ADMIN_EMAIL ?? 'admin@qdc.local'}`
        : 'Development seed already applied.'
    )
  } finally {
    database.client.close()
  }
}

async function runSeedAdmin(databaseUrl: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development admin seed tidak boleh dijalankan pada production.')
  }

  const database = await openDatabase(databaseUrl)

  try {
    await migrateDatabase(database)
    const userId = await seedAdminAccount(database.db)
    console.log(
      `Admin seed completed. User ID: ${userId}. Email: ${process.env.SEED_ADMIN_EMAIL ?? 'admin@qdc.local'}`
    )
  } finally {
    database.client.close()
  }
}

async function runReset(databaseUrl: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database reset tidak boleh dijalankan pada production.')
  }

  await removeDatabaseFiles(databaseUrl)
  const database = await openDatabase(databaseUrl)

  try {
    await migrateDatabase(database)
    const result = await seedDatabase(database.db)
    console.log(
      result.seeded
        ? 'Database reset and development seed completed.'
        : 'Database reset completed.'
    )
  } finally {
    database.client.close()
  }
}

function printUsage(): void {
  console.error('Usage: tsx scripts/database.ts <migrate|seed|seed-admin|reset>')
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const databaseUrl = getDatabaseUrl()

  if (command === 'migrate') {
    await runMigrate(databaseUrl)
    return
  }

  if (command === 'seed') {
    await runSeed(databaseUrl)
    return
  }

  if (command === 'seed-admin') {
    await runSeedAdmin(databaseUrl)
    return
  }

  if (command === 'reset') {
    await runReset(databaseUrl)
    return
  }

  printUsage()
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
