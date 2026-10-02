import { requireAuthSession, shouldRequireAuth } from '../lib/auth-middleware'
import { authorizeDomainRequest } from '../lib/auth-policy'

export default eventHandler(async (event) => {
  const { pathname } = getRequestURL(event)

  if (!shouldRequireAuth(pathname)) {
    return
  }

  const { actor } = await requireAuthSession(event)

  authorizeDomainRequest(pathname, event.method, actor)
})
