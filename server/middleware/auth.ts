import { requireAuthSession, shouldRequireAuth } from '../lib/auth-middleware'

export default eventHandler(async (event) => {
  const { pathname } = getRequestURL(event)

  if (!shouldRequireAuth(pathname)) {
    return
  }

  await requireAuthSession(event)
})
