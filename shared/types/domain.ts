import type {
  AttachmentFileExtension,
  AttachmentMimeType,
  AuditAction,
  AuditEntityType,
  DocumentType,
  QualityIssueDetailAction,
  QualityIssueStatus,
  SampleCondition,
  SampleDefectStatus,
  UserRole
} from '../constants'

export type IsoDateTime = string
export type BusinessDate = string
export type DomainStatus = QualityIssueStatus | SampleDefectStatus

export interface AuditFields {
  created_at: IsoDateTime
  updated_at: IsoDateTime
  created_by_user_id: string
  updated_by_user_id: string
}

export interface AuthenticatedUser {
  id: string
  role: UserRole
}

export interface QualityIssue extends AuditFields {
  id: number
  issue_name: string
  model_name: string
  serial_number: string
  tanggal_kejadian: BusinessDate
  notification_number: string | null
  detail: string | null
  keterangan: string | null
  status: QualityIssueStatus
}

export interface CreateQualityIssueInput {
  issue_name: string
  model_name: string
  serial_number: string
  tanggal_kejadian: BusinessDate
  notification_number?: string | null
  detail?: string | null
  keterangan?: string | null
}

export type UpdateQualityIssueInput = Partial<CreateQualityIssueInput>

export interface QualityIssueDetail extends AuditFields {
  id: number
  issue_id: number
  tanggal: IsoDateTime
  action: string
  remark: string | null
}

export interface CreateQualityIssueDetailInput {
  issue_id: number
  tanggal: IsoDateTime
  action: string
  remark?: string | null
}

export interface SampleDefect extends AuditFields {
  id: number
  batch_id: string
  issue_id: number | null
  notification_number: string
  model_name: string
  serial_number: string
  cabang: string
  part_number: string
  part_name: string
  kerusakan_cabang: string
  status: SampleDefectStatus
  tanggal_terima: IsoDateTime | null
  keterangan_terima: string | null
  nama_penerima_pqa: string | null
  tanggal_serah_pqa: IsoDateTime | null
  kerusakan_verifikasi: string | null
  kondisi_pqa: SampleCondition | null
  repair: string | null
  hasil_analisa_supplier: string | null
}

export interface SampleDefectPartInput {
  part_number: string
  part_name: string
  kerusakan_cabang: string
}

export interface CreateSampleDefectBatchInput {
  issue_id?: number | null
  notification_number: string
  model_name: string
  serial_number: string
  cabang: string
  parts: SampleDefectPartInput[]
}

export interface TechnicalReport extends AuditFields {
  id: number
  issue_id: number | null
  document_number: string
  document_type: DocumentType
  release_date: BusinessDate
  model_name: string
  issue_name: string
  root_cause: string | null
  action: string | null
  improvement_start_date: BusinessDate | null
  improvement_start_serial_number: string | null
  document_reference: string | null
  keterangan: string | null
}

export interface CreateTechnicalReportInput {
  issue_id?: number | null
  document_number: string
  document_type: DocumentType
  release_date: BusinessDate
  model_name: string
  issue_name: string
  root_cause?: string | null
  action?: string | null
  improvement_start_date?: BusinessDate | null
  improvement_start_serial_number?: string | null
  document_reference?: string | null
  keterangan?: string | null
}

export type UpdateTechnicalReportInput = Partial<CreateTechnicalReportInput>

interface AttachmentMetadata extends AuditFields {
  id: number
  file_name: string
  storage_name: string
  file_url: string
  file_type: AttachmentMimeType
  file_size: number
}

export type Attachment
  = | (AttachmentMetadata & {
    detail_id: number
    sample_id: null
    report_id: null
    owner_type: 'QUALITY_ISSUE_DETAIL'
  })
  | (AttachmentMetadata & {
    detail_id: null
    sample_id: number
    report_id: null
    owner_type: 'SAMPLE_DEFECT'
  })
  | (AttachmentMetadata & {
    detail_id: null
    sample_id: null
    report_id: number
    owner_type: 'TECHNICAL_REPORT'
  })

export interface AttachmentUpload {
  file_name: string
  file_type: AttachmentMimeType
  file_extension: AttachmentFileExtension
  file_size: number
}

export interface AuditLog {
  id: number
  entity_type: AuditEntityType
  entity_id: number
  action: AuditAction
  from_status: DomainStatus | null
  to_status: DomainStatus | null
  metadata_json: string | null
  actor_user_id: string
  created_at: IsoDateTime
}

export interface CreateAuditLogInput {
  entity_type: AuditEntityType
  entity_id: number
  action: AuditAction
  from_status?: DomainStatus | null
  to_status?: DomainStatus | null
  metadata_json?: string | null
  actor_user_id: string
}

export interface QualityIssueInitialEvidence {
  action: QualityIssueDetailAction
  remark?: string | null
}
