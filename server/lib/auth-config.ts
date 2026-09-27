import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import type { createDatabase } from '../database/client'
import { authSchema } from '../database/schema/auth-schema'

type AuthDatabase = Awaited<ReturnType<typeof createDatabase>>['db']

export interface AuthConfig {
  baseURL?: string
  secret?: string
}

export function createAuth(database: AuthDatabase, config: AuthConfig = {}) {
  const secret = config.secret ?? process.env.BETTER_AUTH_SECRET
  const baseURL = config.baseURL ?? process.env.BETTER_AUTH_URL

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'sqlite',
      schema: authSchema
    }),
    ...(secret ? { secret } : {}),
    ...(baseURL ? { baseURL } : {}),
    emailAndPassword: {
      enabled: true
    }
  })
}
