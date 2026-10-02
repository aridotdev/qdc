import { describe, expect, it } from 'vitest'
import { authRequestContext } from '../../server/lib/auth-http'
import { shouldRequireAuth } from '../../server/lib/auth-middleware'
import { USER_ROLE } from '../../shared/constants/domain'

describe('server-side auth middleware contract', () => {
  it.each([
    '/api/customers',
    '/api/mails',
    '/api/members',
    '/api/notifications'
  ])('requires a valid session for domain endpoint %s', (pathname) => {
    expect(shouldRequireAuth(pathname)).toBe(true)
  })

  it.each([
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/session',
    '/login',
    '/'
  ])('keeps public path %s reachable without middleware auth', (pathname) => {
    expect(shouldRequireAuth(pathname)).toBe(false)
  })

  it('maps session user to the service actor context', () => {
    const expiresAt = new Date('2026-10-02T15:00:00.000Z')
    const context = authRequestContext({
      user: {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: USER_ROLE.ADMIN
      },
      session: {
        id: 'session-1',
        expiresAt
      }
    })

    expect(context.actor).toEqual({
      userId: 'user-1',
      role: USER_ROLE.ADMIN,
      name: 'Admin User',
      email: 'admin@example.com'
    })
    expect(context.session.expiresAt).toBe(expiresAt)
  })
})
