import type { UserRole } from '../../shared/constants/domain'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface AuthSession {
  user: AuthUser
  session: {
    id: string
    expiresAt: string
  }
}

interface AuthResponse {
  user: AuthUser
}

interface AuthErrorResponse {
  error?: {
    message?: string
  }
}

type AuthClientError = Error & {
  statusCode?: number
  data?: AuthErrorResponse
}

function toAuthError(error: unknown): AuthClientError {
  if (error instanceof Error) {
    return error as AuthClientError
  }

  const authError = new Error('Autentikasi gagal.') as AuthClientError

  if (error && typeof error === 'object') {
    Object.assign(authError, error)
  }

  return authError
}

export const authClient = {
  signIn: {
    email: async (input: { email: string, password: string }) => {
      try {
        const data = await $fetch<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: input,
          credentials: 'include'
        })

        return { data, error: null }
      } catch (error) {
        return { data: null, error: toAuthError(error) }
      }
    }
  },

  signOut: async () => {
    try {
      const data = await $fetch<{ success: boolean }>('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      return { data, error: null }
    } catch (error) {
      return { data: null, error: toAuthError(error) }
    }
  }
}

export function getAuthErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const authError = error as AuthClientError
  const apiMessage = authError.data?.error?.message

  return apiMessage
    ?? (typeof authError.message === 'string' && authError.message.trim()
      ? authError.message
      : undefined)
}
