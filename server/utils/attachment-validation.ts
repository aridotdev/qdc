export function parseAttachmentId(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID attachment tidak valid.'
    })
  }

  return Number(value)
}
