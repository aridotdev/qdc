import db from '@@/server/database'
import { InsertMonitoringSchema, monitoring } from '@@/server/database/schema'
import z from 'zod'

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, InsertMonitoringSchema.parse)

    const result = await db.insert(monitoring).values(body).returning()

    if (result.length === 0) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to insert new monitoring record',
        fatal: true
      })
    }

    setResponseStatus(event, 201)

    return {
      message: 'Monitoring record created successfully',
      success: true,
      monitoring: result[0]
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation Failed'
      })
    }

    console.log('API Error: ', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    })
  }
})