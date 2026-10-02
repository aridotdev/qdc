import { USER_ROLE } from '../../shared/constants/domain'
import type { AuthActor } from './auth-http'

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

  throw createError({
    statusCode: 403,
    statusMessage: 'Akses admin diperlukan.'
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
