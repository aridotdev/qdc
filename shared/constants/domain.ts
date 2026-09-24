export const USER_ROLE = {
  USER: 'USER',
  ADMIN: 'ADMIN'
} as const

export const QUALITY_ISSUE_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  MONITORING: 'MONITORING',
  CLOSED: 'CLOSED'
} as const

export const SAMPLE_DEFECT_STATUS = {
  REQUESTED: 'REQUESTED',
  RECEIVED: 'RECEIVED',
  QRCC_VERIFIED: 'QRCC_VERIFIED',
  HANDED_OVER_TO_PQA: 'HANDED_OVER_TO_PQA',
  PQA_ANALYZED: 'PQA_ANALYZED',
  SUPPLIER_ANALYZED: 'SUPPLIER_ANALYZED'
} as const

export const DOCUMENT_TYPE = {
  TECHNICAL_REPORT: 'TECHNICAL_REPORT',
  SERVICE_TIPS: 'SERVICE_TIPS'
} as const

export const SAMPLE_CONDITION = {
  NG: 'NG',
  NDF: 'NDF'
} as const

export const ATTACHMENT_OWNER_TYPE = {
  QUALITY_ISSUE_DETAIL: 'QUALITY_ISSUE_DETAIL',
  SAMPLE_DEFECT: 'SAMPLE_DEFECT',
  TECHNICAL_REPORT: 'TECHNICAL_REPORT'
} as const

export const AUDIT_ENTITY_TYPE = {
  QUALITY_ISSUE: 'QUALITY_ISSUE',
  QUALITY_ISSUE_DETAIL: 'QUALITY_ISSUE_DETAIL',
  SAMPLE_DEFECT: 'SAMPLE_DEFECT',
  TECHNICAL_REPORT: 'TECHNICAL_REPORT',
  ATTACHMENT: 'ATTACHMENT'
} as const

export const AUDIT_ACTION = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  ROLLBACK: 'ROLLBACK',
  UPLOAD: 'UPLOAD'
} as const

export const QUALITY_ISSUE_DETAIL_ACTION = {
  INITIAL_EVIDENCE: 'INITIAL_EVIDENCE'
} as const

export const ATTACHMENT_FILE_EXTENSION = {
  JPG: 'jpg',
  JPEG: 'jpeg',
  PNG: 'png',
  PDF: 'pdf',
  DOCX: 'docx',
  XLSX: 'xlsx',
  MP4: 'mp4'
} as const

export const ATTACHMENT_MIME_TYPE = {
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  MP4: 'video/mp4'
} as const

export const ATTACHMENT_SIZE_LIMIT_BYTES = {
  IMAGE_DOCUMENT: 1 * 1024 * 1024,
  VIDEO: 10 * 1024 * 1024
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]
export type QualityIssueStatus = (typeof QUALITY_ISSUE_STATUS)[keyof typeof QUALITY_ISSUE_STATUS]
export type SampleDefectStatus = (typeof SAMPLE_DEFECT_STATUS)[keyof typeof SAMPLE_DEFECT_STATUS]
export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE]
export type SampleCondition = (typeof SAMPLE_CONDITION)[keyof typeof SAMPLE_CONDITION]
export type AttachmentOwnerType = (typeof ATTACHMENT_OWNER_TYPE)[keyof typeof ATTACHMENT_OWNER_TYPE]
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPE)[keyof typeof AUDIT_ENTITY_TYPE]
export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION]
export type QualityIssueDetailAction
  = (typeof QUALITY_ISSUE_DETAIL_ACTION)[keyof typeof QUALITY_ISSUE_DETAIL_ACTION]
export type AttachmentFileExtension
  = (typeof ATTACHMENT_FILE_EXTENSION)[keyof typeof ATTACHMENT_FILE_EXTENSION]
export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPE)[keyof typeof ATTACHMENT_MIME_TYPE]

export const QUALITY_ISSUE_STATUSES = Object.values(QUALITY_ISSUE_STATUS)
export const SAMPLE_DEFECT_STATUSES = Object.values(SAMPLE_DEFECT_STATUS)
export const DOCUMENT_TYPES = Object.values(DOCUMENT_TYPE)
export const SAMPLE_CONDITIONS = Object.values(SAMPLE_CONDITION)
export const ATTACHMENT_FILE_EXTENSIONS = Object.values(ATTACHMENT_FILE_EXTENSION)
export const ATTACHMENT_MIME_TYPES = Object.values(ATTACHMENT_MIME_TYPE)
