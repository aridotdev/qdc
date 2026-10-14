import { useRuntimeConfig } from '#imports'
import {
  createQualityIssueRepository,
  type QualityIssueWithDetails
} from '../repositories/quality-issues'
import { createQualityIssueService } from '../services/quality-issues'
import { createQualityIssueStateMachine } from '../services/quality-issue-state-machine'
import { createAttachmentService } from '../services/attachments'
import { createFileStorage } from '../services/file-storage'
import db from '../database'
import { createApiError, createValidationError } from './api-error'
import { ERROR_CODES } from '../../shared/constants'
import { parseQualityIssueIdentifier } from './quality-issue-validation'
import type { ZodType } from 'zod'

type QualityIssueEvent = Parameters<Parameters<typeof eventHandler>[0]>[0]

export interface ParsedQualityIssuePayload<T> {
  payload: T
  files: Array<{
    fileName: string
    mimeType: string
    data: Uint8Array
  }>
}

export function createRuntimeQualityIssueRepository() {
  return createQualityIssueRepository({ db })
}

export function createRuntimeQualityIssueService() {
  const config = useRuntimeConfig()
  const attachments = createAttachmentService({
    db,
    storage: createFileStorage({ rootDir: config.storageRoot })
  })

  return createQualityIssueService({ db, attachments })
}

export function createRuntimeQualityIssueStateMachine() {
  return createQualityIssueStateMachine({ db })
}

export async function resolveQualityIssueId(value: string | undefined): Promise<number> {
  const identifier = parseQualityIssueIdentifier(value)

  if (identifier.type === 'numeric') {
    return identifier.value
  }

  const issue = await createRuntimeQualityIssueRepository().findByPublicId(identifier.value)

  if (!issue) {
    throw createApiError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Quality Issue ${identifier.value} tidak ditemukan.`
    })
  }

  return issue.id
}

function parseMultipartFields(
  parts: Awaited<ReturnType<typeof readMultipartFormData>>
): { fields: Record<string, string>, files: ParsedQualityIssuePayload<unknown>['files'] } {
  const fields: Record<string, string> = {}
  const files: ParsedQualityIssuePayload<unknown>['files'] = []

  for (const part of parts ?? []) {
    if (!part.name) {
      continue
    }

    if (part.filename) {
      files.push({
        fileName: part.filename,
        mimeType: part.type ?? '',
        data: part.data
      })
      continue
    }

    fields[part.name] = new TextDecoder().decode(part.data)
  }

  return { fields, files }
}

export async function readQualityIssuePayload<T>(
  event: QualityIssueEvent,
  schema: ZodType<T>
): Promise<ParsedQualityIssuePayload<T>> {
  const contentType = (getRequestHeader(event, 'content-type') ?? '').toLowerCase()
  const parsed = contentType.startsWith('multipart/form-data')
    ? parseMultipartFields(await readMultipartFormData(event))
    : { fields: await readBody(event), files: [] }

  const result = schema.safeParse(parsed.fields)

  if (!result.success) {
    throw createValidationError(result.error)
  }

  return {
    payload: result.data,
    files: parsed.files
  }
}

export function getQualityIssueDetailOrThrow(
  issue: QualityIssueWithDetails | undefined,
  issueId: number
): QualityIssueWithDetails {
  if (!issue) {
    throw createApiError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Quality Issue ${issueId} tidak ditemukan.`
    })
  }

  return issue
}
