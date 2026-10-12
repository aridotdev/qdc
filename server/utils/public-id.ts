import { v7 as uuidv7 } from 'uuid'
import { PUBLIC_ID_PREFIX, type PublicIdEntity } from '../../shared/constants'

export function createPublicId(entity: PublicIdEntity): string {
  return `${PUBLIC_ID_PREFIX[entity]}${uuidv7()}`
}
