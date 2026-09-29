import { auth } from '../../lib/auth'
import {
  appendAuthCookies,
  getAuthHeaders,
  publicAuthUser
} from '../../lib/auth-http'

interface LoginBody {
  email?: unknown
  password?: unknown
}

export default eventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)

  if (typeof body?.email !== 'string' || typeof body.password !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email dan password wajib diisi.'
    })
  }

  try {
    const result = await auth.api.signInEmail({
      body: {
        email: body.email,
        password: body.password
      },
      headers: getAuthHeaders(event, process.env.BETTER_AUTH_URL),
      returnHeaders: true
    })

    appendAuthCookies(event, result.headers)

    return {
      user: publicAuthUser(result.response.user)
    }
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Email atau password tidak valid.'
    })
  }
})
