import type { AuthSession } from '~/utils/auth-client'

export function useCurrentSession() {
  const session = useState<AuthSession | null | undefined>(
    'current-auth-session',
    () => undefined
  )
  const isLoading = useState('current-auth-session-loading', () => false)

  async function refreshSession(): Promise<AuthSession | null> {
    if (isLoading.value) {
      return session.value ?? null
    }

    isLoading.value = true

    try {
      const requestFetch = useRequestFetch()
      session.value = await requestFetch<AuthSession | null>('/api/auth/session', {
        credentials: 'include'
      })
      return session.value ?? null
    } finally {
      isLoading.value = false
    }
  }

  function clearSession() {
    session.value = null
  }

  return {
    session,
    isLoading,
    refreshSession,
    clearSession
  }
}
