import { PUBLIC_ID_PREFIX, type PublicIdEntity } from '../constants'
import { z } from 'zod'

const UUID_V7_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'

export function publicIdSchema(entity: PublicIdEntity): z.ZodString {
  return z.string().regex(
    new RegExp(`^${PUBLIC_ID_PREFIX[entity]}${UUID_V7_PATTERN}$`),
    `Public ID ${entity} tidak valid.`
  )
}

export const qualityIssuePublicIdSchema = publicIdSchema('QI')
export const sampleDefectPublicIdSchema = publicIdSchema('SD')
export const technicalReportPublicIdSchema = publicIdSchema('TR')
