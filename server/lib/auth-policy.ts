import { ERROR_CODES, USER_ROLE } from '../../shared/constants'
import type { AuthActor } from './auth-http'
import { createApiError } from '../utils/api-error'

export function requiresAdmin(pathname: string, method: string): boolean {
  const normalizedPathname = pathname.replace(/\/+$/, '')
  const normalizedMethod = method.toUpperCase()

  return normalizedMethod === 'DELETE'
    || (normalizedMethod === 'POST' && normalizedPathname.endsWith('/rollback'))
}

export function requireAdmin(actor: AuthActor): void {
  if (actor.role === USER_ROLE.ADMIN) {
    return
  }

  throw createApiError({
    code: ERROR_CODES.FORBIDDEN,
    message: 'Akses admin diperlukan.'
  })
}

export function authorizeDomainRequest(
  pathname: string,
  method: string,
  actor: AuthActor
): void {
  if (requiresAdmin(pathname, method)) {
    requireAdmin(actor)
  }
}
