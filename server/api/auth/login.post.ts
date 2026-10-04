import { auth } from '../../lib/auth'
import {
  appendAuthCookies,
  getAuthHeaders,
  publicAuthUser
} from '../../lib/auth-http'

import { ERROR_CODES } from '../../../shared/constants'
import { createApiError, toApiError } from '../../utils/api-error'

interface LoginBody {
  email?: unknown
  password?: unknown
}

export default eventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)

  if (typeof body?.email !== 'string' || typeof body.password !== 'string') {
    throw createApiError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Email dan password wajib diisi.'
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
  } catch (error) {
    throw toApiError(error)
  }
})
