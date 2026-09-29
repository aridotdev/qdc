import { auth } from '../../lib/auth'
import { appendAuthCookies, getAuthHeaders } from '../../lib/auth-http'

export default eventHandler(async (event) => {
  const result = await auth.api.signOut({
    headers: getAuthHeaders(event),
    returnHeaders: true
  })

  appendAuthCookies(event, result.headers)

  return result.response
})
