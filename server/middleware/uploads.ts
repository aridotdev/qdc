export default eventHandler((event) => {
  const { pathname } = getRequestURL(event)

  if (pathname.startsWith('/uploads/')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    })
  }
})
