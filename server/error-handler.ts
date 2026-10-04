import { getApiErrorResponse } from './utils/api-error'

export default defineNitroErrorHandler(async (error, event, { defaultHandler }) => {
  if (!getRequestURL(event).pathname.startsWith('/api/')) {
    const response = await defaultHandler(error, event)
    setResponseHeaders(event, response.headers)
    setResponseStatus(event, response.status, response.statusText)
    await send(event, typeof response.body === 'string'
      ? response.body
      : JSON.stringify(response.body))
    return
  }

  const response = await defaultHandler(error, event, {
    json: true,
    silent: true
  })

  const body = {
    error: getApiErrorResponse(error)
  }

  setResponseHeaders(event, response.headers)
  setResponseStatus(event, response.status, response.statusText)

  await send(event, JSON.stringify(body))
})
