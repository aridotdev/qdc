import type { AuthRequestContext } from './auth-http'
import { getAuthHeaders, setAuthContext } from './auth-http'

import { ERROR_CODES } from '../../shared/constants'
import { createApiError } from '../utils/api-error'

type AuthEvent = Parameters<Parameters<typeof eventHandler>[0]>[0]

export function shouldRequireAuth(pathname: string): boolean {
  return pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')
}

export async function requireAuthSession(event: AuthEvent): Promise<AuthRequestContext> {
  const { auth } = await import('./auth')
  const session = await auth.api.getSession({
    headers: getAuthHeaders(event)
  })

  if (!session) {
    throw createApiError({ code: ERROR_CODES.UNAUTHORIZED })
  }

  return setAuthContext(event, session)
}
