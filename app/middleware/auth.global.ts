export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') {
    return
  }

  const { session, refreshSession } = useCurrentSession()

  if (session.value === undefined) {
    await refreshSession()
  }

  if (!session.value) {
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    })
  }
})
