import { describe, expect, it } from 'vitest'
import { authRequestContext } from '../../server/lib/auth-http'
import { shouldRequireAuth } from '../../server/lib/auth-middleware'
import { authorizeDomainRequest, requiresAdmin } from '../../server/lib/auth-policy'
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

  it.each([
    ['GET', '/api/quality-issues'],
    ['POST', '/api/quality-issues'],
    ['PATCH', '/api/quality-issues/1'],
    ['POST', '/api/quality-issues/1/status'],
    ['POST', '/api/sample-defects/1/receive']
  ])('allows authenticated user policy for %s %s', (method, pathname) => {
    expect(requiresAdmin(pathname, method)).toBe(false)
  })

  it.each([
    ['DELETE', '/api/quality-issues/1'],
    ['DELETE', '/api/sample-defects/1'],
    ['DELETE', '/api/technical-reports/1'],
    ['DELETE', '/api/attachments/1'],
    ['POST', '/api/sample-defects/1/rollback']
  ])('requires admin policy for %s %s', (method, pathname) => {
    expect(requiresAdmin(pathname, method)).toBe(true)
  })

  it('rejects authenticated non-admin for delete and rollback', () => {
    const createError = globalThis.createError
    globalThis.createError = ((input: {
      statusCode: number
      statusMessage: string
    }) => Object.assign(new Error(input.statusMessage), input)) as typeof globalThis.createError

    try {
      const actor = {
        userId: 'user-1',
        role: USER_ROLE.USER,
        name: 'Regular User',
        email: 'user@example.com'
      }

      expect(() => authorizeDomainRequest('/api/quality-issues/1', 'DELETE', actor))
        .toThrowError(expect.objectContaining({ statusCode: 403 }))
      expect(() => authorizeDomainRequest('/api/sample-defects/1/rollback', 'POST', actor))
        .toThrowError(expect.objectContaining({ statusCode: 403 }))
    } finally {
      globalThis.createError = createError
    }
  })

  it('allows admin for delete and rollback', () => {
    const actor = {
      userId: 'admin-1',
      role: USER_ROLE.ADMIN,
      name: 'Admin User',
      email: 'admin@example.com'
    }

    expect(() => authorizeDomainRequest('/api/quality-issues/1', 'DELETE', actor))
      .not.toThrow()
    expect(() => authorizeDomainRequest('/api/sample-defects/1/rollback', 'POST', actor))
      .not.toThrow()
  })
})
