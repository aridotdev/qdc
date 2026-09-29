import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createDatabase } from '../../server/database/client'
import {
  AUTH_SESSION_EXPIRES_IN_SECONDS,
  createAuth
} from '../../server/lib/auth-config'
import { USER_ROLE } from '../../shared/constants/domain'
import { account, session, user } from '../../server/database/schema'

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

  it('supports signup, valid login, session retrieval, and logout', async () => {
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
    expect(signUp.user.role).toBe(USER_ROLE.ADMIN)

    const [storedAccount] = await database.db
      .select({ password: account.password })
      .from(account)
      .where(eq(account.userId, signUp.user.id))

    expect(storedAccount?.password).toBeTruthy()
    expect(storedAccount?.password).not.toBe('correct-horse-battery-staple')

    await expect(auth.api.signInEmail({
      body: {
        email: 'auth-test@example.com',
        password: 'wrong-password'
      },
      headers
    })).rejects.toThrow()

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
    const [storedSession] = await database.db
      .select({
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      })
      .from(session)
      .where(eq(session.userId, signIn.response.user.id))

    expect(signIn.response.user.email).toBe('auth-test@example.com')
    expect(storedSession).toBeDefined()
    expect(
      Math.round((storedSession!.expiresAt.getTime() - storedSession!.createdAt.getTime()) / 1000)
    ).toBe(AUTH_SESSION_EXPIRES_IN_SECONDS)

    const activeSession = await auth.api.getSession({
      headers: sessionHeaders
    })

    expect(activeSession?.user.email).toBe('auth-test@example.com')
    expect(activeSession?.user.role).toBe(USER_ROLE.ADMIN)

    const signOut = await auth.api.signOut({
      headers: sessionHeaders,
      returnHeaders: true
    })

    expect(signOut.response.success).toBe(true)
    await expect(
      auth.api.getSession({ headers: sessionHeaders })
    ).resolves.toBeNull()
  })

  it('assigns USER to accounts after the first bootstrap account', async () => {
    const auth = createAuth(database.db, {
      baseURL,
      secret: 'test-secret-that-is-at-least-32-characters-long'
    })
    const headers = new Headers({ origin: baseURL })

    const signUp = await auth.api.signUpEmail({
      body: {
        name: 'Second Auth User',
        email: 'second-auth-test@example.com',
        password: 'correct-horse-battery-staple'
      },
      headers
    })
    const [storedUser] = await database.db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, signUp.user.id))

    expect(signUp.user.role).toBe(USER_ROLE.USER)
    expect(storedUser?.role).toBe(USER_ROLE.USER)
  })

  it('does not retrieve an expired session', async () => {
    const auth = createAuth(database.db, {
      baseURL,
      secret: 'test-secret-that-is-at-least-32-characters-long'
    })
    const headers = new Headers({ origin: baseURL })

    await auth.api.signUpEmail({
      body: {
        name: 'Expired Session User',
        email: 'expired-session@example.com',
        password: 'correct-horse-battery-staple'
      },
      headers
    })

    const signIn = await auth.api.signInEmail({
      body: {
        email: 'expired-session@example.com',
        password: 'correct-horse-battery-staple'
      },
      headers,
      returnHeaders: true
    })
    const sessionHeaders = new Headers({
      cookie: getSessionCookie(signIn.headers)
    })

    await database.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.userId, signIn.response.user.id))

    await expect(
      auth.api.getSession({ headers: sessionHeaders })
    ).resolves.toBeNull()
  })
})
