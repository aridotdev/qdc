import { asc, eq } from 'drizzle-orm'
import db from '@@/server/database'
import { monitoring, category } from '@@/server/database/schema'

export default defineEventHandler(async () => {
  try {
    const getMonitoring = await db
      .select({
        id: monitoring.id,
        month: monitoring.month,
        fiscal: monitoring.fiscal,
        total: monitoring.total,
        ok: monitoring.ok,
        ng: monitoring.ng,
        categoryId: monitoring.categoryId,
        createdAt: monitoring.createdAt,
        updatedAt: monitoring.updatedAt,
        category: {
          id: category.id,
          name: category.name
        }
      })
      .from(monitoring)
      .leftJoin(category, eq(monitoring.categoryId, category.id))
      .orderBy(asc(monitoring.id))

    return {
      message: 'Successfully retrieved all monitoring records.',
      data: getMonitoring
    }
  } catch (error) {
    console.error('API Error: Cannot retrieve monitoring records:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch monitoring records due to a database error.'
    })
  }
})