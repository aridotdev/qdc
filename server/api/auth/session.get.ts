import { auth } from '../../lib/auth'
import { getAuthHeaders, publicAuthUser } from '../../lib/auth-http'

export default eventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: getAuthHeaders(event)
  })

  if (!session) {
    return null
  }

  return {
    user: publicAuthUser(session.user),
    session: {
      id: session.session.id,
      expiresAt: session.session.expiresAt
    }
  }
})
