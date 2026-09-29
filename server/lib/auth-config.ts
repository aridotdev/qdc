import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { sql } from 'drizzle-orm'
import { USER_ROLE } from '../../shared/constants/domain'
import type { createDatabase } from '../database/client'
import { authSchema, user } from '../database/schema/auth-schema'

type AuthDatabase = Awaited<ReturnType<typeof createDatabase>>['db']
export const AUTH_SESSION_EXPIRES_IN_SECONDS = 8 * 60 * 60

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
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          input: false,
          defaultValue: USER_ROLE.USER
        }
      }
    },
    session: {
      expiresIn: AUTH_SESSION_EXPIRES_IN_SECONDS
    },
    emailAndPassword: {
      enabled: true
    },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => {
            const [row] = await database
              .select({ count: sql<number>`count(*)` })
              .from(user)

            return {
              data: {
                ...newUser,
                role: Number(row?.count ?? 0) === 0 ? USER_ROLE.ADMIN : USER_ROLE.USER
              }
            }
          }
        }
      }
    }
  })
}
