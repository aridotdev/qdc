import db from '../database/index' // your drizzle instance
import { createAuth } from './auth-config'

export const auth = createAuth(db)
