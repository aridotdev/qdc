export default defineNuxtRouteMiddleware(async () => {
  const { session, refreshSession } = useCurrentSession()

  if (session.value === undefined) {
    await refreshSession()
  }

  if (session.value) {
    return navigateTo('/')
  }
})
