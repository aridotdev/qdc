export const PUBLIC_ID_ENTITY = {
  QUALITY_ISSUE: 'QI',
  SAMPLE_DEFECT: 'SD',
  TECHNICAL_REPORT: 'TR',
  ATTACHMENT: 'ATT'
} as const

export type PublicIdEntity = (typeof PUBLIC_ID_ENTITY)[keyof typeof PUBLIC_ID_ENTITY]

export const PUBLIC_ID_PREFIX = {
  [PUBLIC_ID_ENTITY.QUALITY_ISSUE]: 'QI-',
  [PUBLIC_ID_ENTITY.SAMPLE_DEFECT]: 'SD-',
  [PUBLIC_ID_ENTITY.TECHNICAL_REPORT]: 'TR-',
  [PUBLIC_ID_ENTITY.ATTACHMENT]: 'ATT-'
} as const satisfies Record<PublicIdEntity, string>
