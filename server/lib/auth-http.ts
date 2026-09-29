import { USER_ROLE } from '../../shared/constants/domain'

type AuthEvent = Parameters<Parameters<typeof eventHandler>[0]>[0]

function splitSetCookieHeader(header: string | null): string[] {
  if (!header) {
    return []
  }

  const cookies: string[] = []
  let start = 0

  for (let index = 0; index < header.length; index++) {
    if (header[index] === ',' && /^\s*[^=;,\s]+=/.test(header.slice(index + 1))) {
      cookies.push(header.slice(start, index).trim())
      start = index + 1
    }
  }

  cookies.push(header.slice(start).trim())
  return cookies.filter(Boolean)
}

export function getAuthHeaders(event: AuthEvent, fallbackOrigin?: string): Headers {
  const headers = new Headers()

  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (value) {
      headers.set(key, value)
    }
  }

  if (!headers.has('origin') && fallbackOrigin) {
    headers.set('origin', fallbackOrigin)
  }

  return headers
}

export function appendAuthCookies(event: AuthEvent, headers: Headers): void {
  const responseHeaders = headers as Headers & {
    getSetCookie?: () => string[]
  }
  const headerCookies = responseHeaders.getSetCookie?.()
    ?? splitSetCookieHeader(headers.get('set-cookie'))

  for (const cookie of headerCookies) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }
}

export function publicAuthUser(user: {
  id: string
  name: string
  email: string
  role?: string | null
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === USER_ROLE.ADMIN ? USER_ROLE.ADMIN : USER_ROLE.USER
  }
}
