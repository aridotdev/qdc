import { useCurrentSession } from './useCurrentSession'

const VALID_ROLES = ['USER', 'ADMIN'] as const

export function useUserProfile() {
  const { session, refreshSession } = useCurrentSession()

  const user = computed(() => session.value?.user ?? null)
  const hasValidRole = computed(() => {
    const role = user.value?.role
    return VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])
  })
  const isActive = computed(() => user.value !== null)

  async function fetchProfile() {
    if (session.value === undefined) {
      await refreshSession()
    }

    return user.value
  }

  return {
    user,
    hasValidRole,
    isActive,
    fetchProfile
  }
}
