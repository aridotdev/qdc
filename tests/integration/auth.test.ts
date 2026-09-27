import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createDatabase } from '../../server/database/client'
import { createAuth } from '../../server/lib/auth-config'

const migrationsFolder = join(process.cwd(), 'server/database/migrations')
const baseURL = 'http://localhost:3000'

function getSessionCookie(headers: Headers): string {
  const setCookie = headers.get('set-cookie')
  const match = setCookie?.match(/(?:^|,\s*)better-auth\.session_token=([^;]+)/)

  if (!match?.[1]) {
    throw new Error('Better Auth session cookie tidak ditemukan.')
  }

  return `better-auth.session_token=${match[1]}`
}

describe('Better Auth schema and basic session flow', () => {
  let database: Awaited<ReturnType<typeof createDatabase>>
  let directory: string

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'qdc-auth-'))
    database = await createDatabase(`file:${join(directory, 'test.sqlite')}`)
    await migrate(database.db, { migrationsFolder })
  })

  afterAll(async () => {
    database.client.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('creates the Better Auth tables from an empty SQLite database', async () => {
    const tables = await database.client.execute({
      sql: 'SELECT name FROM sqlite_master WHERE type = ? AND name IN (?, ?, ?, ?) ORDER BY name',
      args: ['table', 'account', 'session', 'user', 'verification']
    })

    expect(tables.rows).toEqual([
      { name: 'account' },
      { name: 'session' },
      { name: 'user' },
      { name: 'verification' }
    ])
  })

  it('supports signup, login, session retrieval, and logout', async () => {
    const auth = createAuth(database.db, {
      baseURL,
      secret: 'test-secret-that-is-at-least-32-characters-long'
    })
    const headers = new Headers({ origin: baseURL })

    const signUp = await auth.api.signUpEmail({
      body: {
        name: 'Auth Test User',
        email: 'auth-test@example.com',
        password: 'correct-horse-battery-staple'
      },
      headers
    })

    expect(signUp.user.email).toBe('auth-test@example.com')

    const signIn = await auth.api.signInEmail({
      body: {
        email: 'auth-test@example.com',
        password: 'correct-horse-battery-staple'
      },
      headers,
      returnHeaders: true
    })
    const sessionHeaders = new Headers({
      cookie: getSessionCookie(signIn.headers)
    })

    expect(signIn.response.user.email).toBe('auth-test@example.com')

    const session = await auth.api.getSession({
      headers: sessionHeaders
    })

    expect(session?.user.email).toBe('auth-test@example.com')

    const signOut = await auth.api.signOut({
      headers: sessionHeaders,
      returnHeaders: true
    })

    expect(signOut.response.success).toBe(true)
    await expect(
      auth.api.getSession({ headers: sessionHeaders })
    ).resolves.toBeNull()
  })
})
