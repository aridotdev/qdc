import { desc } from 'drizzle-orm'
import db from '@@/server/database'
import { category } from '@@/server/database/schema'

export default defineEventHandler(async () => {
  try {
    const getCategory = await db
      .select({ id: category.id, name: category.name })
      .from(category)
      .orderBy(desc(category.id))
    // const getCategory = await db.query.category.findMany();
    return {
      message: 'Successfully retrieved all categories.',
      data: getCategory
    }
  } catch (error) {
    console.error('API Error: Cannot retrieve categories:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to fetch categories due to a database error.'
    })
  }
})
