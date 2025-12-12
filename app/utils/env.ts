import { z } from 'zod'

import tryParseEnv from './try-parse-env'

const EnvSchema = z.object({
  DB_FILE_NAME: z.string()
  // BANANA: z.string()
})

export type EnvSchema = z.infer<typeof EnvSchema>

tryParseEnv(EnvSchema)

export default EnvSchema.parse(process.env)
