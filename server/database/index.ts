import { useRuntimeConfig } from '#imports'
import { createDatabase } from './client'

const { db } = await createDatabase(useRuntimeConfig().dbFileName)

export default db
