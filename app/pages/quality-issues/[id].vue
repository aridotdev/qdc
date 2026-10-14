<script setup lang="ts">
import {
  ATTACHMENT_MIME_TYPE,
  ATTACHMENT_SIZE_LIMIT_BYTES,
  ERROR_CODES,
  QUALITY_ISSUE_STATUS,
  USER_ROLE,
  type QualityIssueStatus
} from '#shared'
import { formatIndonesianDate, formatIndonesianDateTime } from '~/utils/date'

interface QualityIssueAttachment {
  id: number
  fileName: string
  fileType: string
  fileSize: number
}

interface QualityIssueDetail {
  id: number
  issueId: number
  tanggal: string
  action: string
  remark: string | null
  attachments: QualityIssueAttachment[]
}

interface QualityIssue {
  id: number
  publicId: string
  businessId: string | null
  issueName: string
  modelName: string
  serialNumber: string
  tanggalKejadian: string
  notificationNumber: string | null
  detail: string
  keterangan: string | null
  status: QualityIssueStatus
  createdAt: string
  updatedAt: string
  details: QualityIssueDetail[]
}

interface QualityIssueDetailsResponse {
  issueId: number
  details: QualityIssueDetail[]
}

type StatusOperation = 'FORWARD' | 'ROLLBACK'

const route = useRoute()
const toast = useToast()
const { user } = useUserProfile()

const issueIdentifier = computed(() => String(route.params.id ?? ''))
const issueUrl = computed(() => `/api/quality-issues/${encodeURIComponent(issueIdentifier.value)}`)
const detailsUrl = computed(() => `${issueUrl.value}/details`)

const {
  data: issue,
  error: issueError,
  status: issueStatus,
  refresh: refreshIssue
} = await useFetch<QualityIssue | null>(issueUrl, {
  lazy: true,
  default: () => null
})

const {
  data: timelineResponse,
  error: timelineError,
  status: timelineStatus,
  refresh: refreshTimeline
} = await useFetch<QualityIssueDetailsResponse | null>(detailsUrl, {
  lazy: true,
  default: () => null
})

const isAdmin = computed(() => user.value?.role === USER_ROLE.ADMIN)
const isIssueLoading = computed(() => issueStatus.value === 'pending')
const isTimelineLoading = computed(() => timelineStatus.value === 'pending')
const hasIssue = computed(() => issue.value !== null)
const details = computed(() => timelineResponse.value?.details ?? issue.value?.details ?? [])

const statusLabels: Record<QualityIssueStatus, string> = {
  [QUALITY_ISSUE_STATUS.OPEN]: 'Open',
  [QUALITY_ISSUE_STATUS.IN_PROGRESS]: 'In Progress',
  [QUALITY_ISSUE_STATUS.MONITORING]: 'Monitoring',
  [QUALITY_ISSUE_STATUS.CLOSED]: 'Closed'
}

const statusColors: Record<QualityIssueStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  [QUALITY_ISSUE_STATUS.OPEN]: 'neutral',
  [QUALITY_ISSUE_STATUS.IN_PROGRESS]: 'info',
  [QUALITY_ISSUE_STATUS.MONITORING]: 'warning',
  [QUALITY_ISSUE_STATUS.CLOSED]: 'success'
}

const statusOrder: QualityIssueStatus[] = [
  QUALITY_ISSUE_STATUS.OPEN,
  QUALITY_ISSUE_STATUS.IN_PROGRESS,
  QUALITY_ISSUE_STATUS.MONITORING,
  QUALITY_ISSUE_STATUS.CLOSED
]

function getTargetStatus(operation: StatusOperation): QualityIssueStatus | undefined {
  if (!issue.value) return undefined

  const currentIndex = statusOrder.indexOf(issue.value.status)

  if (operation === 'FORWARD') {
    return statusOrder[currentIndex + 1]
  }

  return statusOrder[currentIndex - 1]
}

const nextStatus = computed(() => getTargetStatus('FORWARD'))
const previousStatus = computed(() => getTargetStatus('ROLLBACK'))
const canForward = computed(() => nextStatus.value !== undefined)
const canRollback = computed(() => isAdmin.value && previousStatus.value !== undefined)

const progressAttachments = ref<File[]>([])
const progressState = reactive({
  action: '',
  remark: ''
})
const progressError = ref('')
const isSubmittingProgress = ref(false)

const confirmationOpen = ref(false)
const confirmationOperation = ref<StatusOperation | null>(null)
const rollbackReason = ref('')
const statusError = ref('')
const isUpdatingStatus = ref(false)

const attachmentAccept = '.jpg,.jpeg,.png,.pdf,.docx,.xlsx,.mp4'
const attachmentPolicies: Record<string, { mimeType: string, maxSize: number }> = {
  jpg: { mimeType: ATTACHMENT_MIME_TYPE.JPG, maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT },
  jpeg: { mimeType: ATTACHMENT_MIME_TYPE.JPEG, maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT },
  png: { mimeType: ATTACHMENT_MIME_TYPE.PNG, maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT },
  pdf: { mimeType: ATTACHMENT_MIME_TYPE.PDF, maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT },
  docx: { mimeType: ATTACHMENT_MIME_TYPE.DOCX, maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT },
  xlsx: { mimeType: ATTACHMENT_MIME_TYPE.XLSX, maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT },
  mp4: { mimeType: ATTACHMENT_MIME_TYPE.MP4, maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.VIDEO }
}

function getApiError(error: unknown, fallback: string): {
  code?: string
  message: string
} {
  if (!error || typeof error !== 'object') {
    return { message: fallback }
  }

  const response = error as {
    statusCode?: number
    data?: {
      error?: {
        code?: string
        message?: string
      }
    }
  }
  const apiError = response.data?.error

  return {
    code: apiError?.code,
    message: apiError?.message ?? fallback
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return getApiError(error, fallback).message
}

function isNotFound(error: unknown): boolean {
  const apiError = getApiError(error, '')
  return apiError.code === ERROR_CODES.NOT_FOUND
    || (typeof error === 'object' && error !== null && 'statusCode' in error
      && (error as { statusCode?: number }).statusCode === 404)
}

function formatStatus(status: QualityIssueStatus): string {
  return statusLabels[status]
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function validateAttachments(files: File[]): string {
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    const policy = attachmentPolicies[extension]

    if (!policy || file.type !== policy.mimeType) {
      return `${file.name}: extension dan MIME file tidak didukung atau tidak cocok.`
    }

    if (file.size > policy.maxSize) {
      return `${file.name}: ukuran file melebihi batas ${formatFileSize(policy.maxSize)}.`
    }
  }

  return ''
}

watch(progressAttachments, (files) => {
  progressError.value = validateAttachments(files)
})

function attachmentUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}`
}

async function refreshData(): Promise<void> {
  await Promise.all([refreshIssue(), refreshTimeline()])
}

function retryIssue(): void {
  void refreshData()
}

function retryTimeline(): void {
  void refreshTimeline()
}

async function submitProgress(): Promise<void> {
  if (isSubmittingProgress.value) return

  progressError.value = validateAttachments(progressAttachments.value)

  if (!progressState.action.trim() || progressError.value) {
    if (!progressState.action.trim()) {
      progressError.value = 'Action progress wajib diisi.'
    }
    return
  }

  isSubmittingProgress.value = true

  try {
    const formData = new FormData()
    formData.append('action', progressState.action.trim())

    if (progressState.remark.trim()) {
      formData.append('remark', progressState.remark.trim())
    }

    for (const file of progressAttachments.value) {
      formData.append('attachment', file)
    }

    await $fetch(`${detailsUrl.value}`, {
      method: 'POST',
      body: formData
    })

    progressState.action = ''
    progressState.remark = ''
    progressAttachments.value = []
    progressError.value = ''
    toast.add({
      title: 'Progress berhasil ditambahkan',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    await refreshData()
  } catch (error) {
    progressError.value = errorMessage(error, 'Progress gagal ditambahkan. Silakan coba lagi.')
  } finally {
    isSubmittingProgress.value = false
  }
}

function openStatusConfirmation(operation: StatusOperation): void {
  if (operation === 'FORWARD' && !canForward.value) return
  if (operation === 'ROLLBACK' && !canRollback.value) return

  confirmationOperation.value = operation
  rollbackReason.value = ''
  statusError.value = ''
  confirmationOpen.value = true
}

function closeStatusConfirmation(): void {
  if (isUpdatingStatus.value) return

  confirmationOpen.value = false
  confirmationOperation.value = null
  rollbackReason.value = ''
  statusError.value = ''
}

async function confirmStatusChange(): Promise<void> {
  if (!confirmationOperation.value || isUpdatingStatus.value) return

  isUpdatingStatus.value = true
  statusError.value = ''

  try {
    await $fetch(issueUrl.value + '/status', {
      method: 'POST',
      body: {
        operation: confirmationOperation.value,
        ...(rollbackReason.value.trim()
          ? { reason: rollbackReason.value.trim() }
          : {})
      }
    })

    toast.add({
      title: 'Status berhasil diperbarui',
      description: issue.value
        ? `Status menjadi ${formatStatus(getTargetStatus(confirmationOperation.value) ?? issue.value.status)}.`
        : undefined,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    closeStatusConfirmation()
    await refreshData()
  } catch (error) {
    statusError.value = errorMessage(error, 'Status gagal diperbarui. Silakan coba lagi.')
  } finally {
    isUpdatingStatus.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="quality-issue-detail">
    <template #header>
      <UDashboardNavbar :title="issue?.issueName ?? 'Quality Issue Detail'">
        <template #leading>
          <UButton
            to="/quality-issues"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            aria-label="Kembali ke Quality Issues"
          />
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="issueError && !hasIssue"
        color="error"
        variant="subtle"
        :title="isNotFound(issueError) ? 'Quality Issue tidak ditemukan' : 'Data gagal dimuat'"
        :description="errorMessage(issueError, 'Quality Issue gagal dimuat. Silakan coba lagi.')"
      >
        <template #actions>
          <UButton
            label="Coba lagi"
            color="error"
            variant="outline"
            :loading="isIssueLoading"
            @click="retryIssue"
          />
        </template>
      </UAlert>

      <div v-else-if="isIssueLoading && !hasIssue" class="space-y-4">
        <USkeleton class="h-10 w-2/3" />
        <div class="grid gap-4 lg:grid-cols-2">
          <USkeleton class="h-64" />
          <USkeleton class="h-64" />
        </div>
        <USkeleton class="h-96" />
      </div>

      <div v-else-if="issue" class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm text-muted">
              {{ issue.businessId ?? issue.publicId }}
            </p>
            <h1 class="mt-1 text-2xl font-semibold text-highlighted">
              {{ issue.issueName }}
            </h1>
            <p class="mt-1 text-sm text-muted">
              Dibuat {{ formatIndonesianDateTime(issue.createdAt) }}
            </p>
          </div>

          <UBadge
            :color="statusColors[issue.status]"
            variant="subtle"
            class="capitalize"
          >
            {{ formatStatus(issue.status) }}
          </UBadge>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="font-semibold text-highlighted">
                  Status
                </h2>
                <p class="text-sm text-muted">
                  Perubahan status mengikuti alur Quality Issue.
                </p>
              </div>
              <span class="text-xs text-muted">
                Diperbarui {{ formatIndonesianDateTime(issue.updatedAt) }}
              </span>
            </div>
          </template>

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="canForward"
              :label="`Lanjut ke ${formatStatus(nextStatus!)}`"
              icon="i-lucide-arrow-right"
              :disabled="isUpdatingStatus"
              @click="openStatusConfirmation('FORWARD')"
            />
            <UButton
              v-if="canRollback"
              label="Rollback"
              color="neutral"
              variant="outline"
              icon="i-lucide-undo-2"
              :disabled="isUpdatingStatus"
              @click="openStatusConfirmation('ROLLBACK')"
            />
            <span v-if="!canForward && !canRollback" class="text-sm text-muted">
              Tidak ada action status yang tersedia.
            </span>
          </div>
        </UCard>

        <div class="grid gap-4 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Informasi Quality Issue
              </h2>
            </template>

            <dl class="grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-muted">
                  Public ID
                </dt>
                <dd class="mt-1 break-all font-mono text-sm">
                  {{ issue.publicId }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  Tanggal kejadian
                </dt>
                <dd class="mt-1 text-sm">
                  {{ formatIndonesianDate(issue.tanggalKejadian) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  Model name
                </dt>
                <dd class="mt-1 text-sm">
                  {{ issue.modelName }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  Serial number
                </dt>
                <dd class="mt-1 text-sm">
                  {{ issue.serialNumber }}
                </dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-xs text-muted">
                  Notification number
                </dt>
                <dd class="mt-1 text-sm">
                  {{ issue.notificationNumber || '—' }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Deskripsi
              </h2>
            </template>

            <div class="space-y-4 text-sm">
              <div>
                <p class="text-xs text-muted">
                  Detail
                </p>
                <p class="mt-1 whitespace-pre-wrap">
                  {{ issue.detail }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted">
                  Keterangan
                </p>
                <p class="mt-1 whitespace-pre-wrap">
                  {{ issue.keterangan || '—' }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <div>
              <h2 class="font-semibold text-highlighted">
                Timeline
              </h2>
              <p class="text-sm text-muted">
                Riwayat evidence dan progress Quality Issue.
              </p>
            </div>
          </template>

          <UAlert
            v-if="timelineError"
            color="error"
            variant="subtle"
            title="Timeline gagal dimuat"
            :description="errorMessage(timelineError, 'Timeline gagal dimuat. Silakan coba lagi.')"
          >
            <template #actions>
              <UButton
                label="Coba lagi"
                color="error"
                variant="outline"
                :loading="isTimelineLoading"
                @click="retryTimeline"
              />
            </template>
          </UAlert>

          <div v-else-if="isTimelineLoading && !details.length" class="space-y-4">
            <USkeleton class="h-20" />
            <USkeleton class="h-20" />
          </div>

          <div v-else-if="details.length" class="space-y-5">
            <article
              v-for="(detail, index) in details"
              :key="detail.id"
              class="relative border-l border-default pl-5"
            >
              <span
                class="absolute -left-1.5 top-1.5 size-3 rounded-full bg-primary ring-4 ring-default"
              />
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p class="font-medium text-highlighted">
                    {{ detail.action }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ index === 0 ? 'Initial evidence' : 'Progress' }}
                  </p>
                </div>
                <time class="text-xs text-muted" :datetime="detail.tanggal">
                  {{ formatIndonesianDateTime(detail.tanggal) }}
                </time>
              </div>

              <p v-if="detail.remark" class="mt-3 whitespace-pre-wrap text-sm text-muted">
                {{ detail.remark }}
              </p>

              <div v-if="detail.attachments.length" class="mt-3 space-y-2">
                <p class="text-xs font-medium text-muted">
                  Attachment
                </p>
                <div
                  v-for="attachment in detail.attachments"
                  :key="attachment.id"
                  class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-default px-3 py-2"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-muted" />
                    <span class="truncate text-sm">{{ attachment.fileName }}</span>
                    <span class="shrink-0 text-xs uppercase text-muted">
                      {{ attachment.fileType }}
                    </span>
                    <span class="shrink-0 text-xs text-muted">
                      {{ formatFileSize(attachment.fileSize) }}
                    </span>
                  </div>
                  <UButton
                    :to="attachmentUrl(attachment.id)"
                    target="_blank"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-external-link"
                    label="Buka"
                  />
                </div>
              </div>
            </article>
          </div>

          <p v-else class="py-6 text-center text-sm text-muted">
            Belum ada timeline Quality Issue.
          </p>
        </UCard>

        <UCard>
          <template #header>
            <div>
              <h2 class="font-semibold text-highlighted">
                Tambah progress
              </h2>
              <p class="text-sm text-muted">
                Catat action terbaru dan lampiran pendukung.
              </p>
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="submitProgress">
            <UAlert
              v-if="progressError"
              color="error"
              variant="subtle"
              title="Progress gagal disimpan"
              :description="progressError"
            />

            <UFormField label="Action" required>
              <UInput
                v-model="progressState.action"
                class="w-full"
                placeholder="Contoh: Pemeriksaan lanjutan"
                :disabled="isSubmittingProgress"
              />
            </UFormField>

            <UFormField label="Remark">
              <UTextarea
                v-model="progressState.remark"
                class="w-full"
                :rows="4"
                placeholder="Catatan progress jika ada"
                :disabled="isSubmittingProgress"
              />
            </UFormField>

            <UFormField label="Attachment">
              <UFileUpload
                v-model="progressAttachments"
                position="inside"
                layout="list"
                multiple
                :accept="attachmentAccept"
                label="Pilih atau seret file ke sini"
                description="JPG, PNG, PDF, DOCX, XLSX maksimal 1 MB | MP4 maksimal 10 MB"
                :disabled="isSubmittingProgress"
                class="w-full"
                :ui="{ base: 'min-h-32' }"
              />
            </UFormField>

            <div class="flex justify-end">
              <UButton
                type="submit"
                icon="i-lucide-plus"
                label="Tambah progress"
                :loading="isSubmittingProgress"
                :disabled="isSubmittingProgress"
              />
            </div>
          </form>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="confirmationOpen"
    :title="confirmationOperation === 'ROLLBACK' ? 'Rollback Quality Issue' : 'Ubah status Quality Issue'"
    :description="
      confirmationOperation === 'ROLLBACK'
        ? `Status akan dikembalikan ke ${formatStatus(previousStatus!)}.`
        : `Status akan dilanjutkan ke ${formatStatus(nextStatus!)}.`
    "
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="statusError"
          color="error"
          variant="subtle"
          title="Status gagal diperbarui"
          :description="statusError"
        />

        <UFormField v-if="confirmationOperation === 'ROLLBACK'" label="Alasan rollback">
          <UTextarea
            v-model="rollbackReason"
            :rows="3"
            class="w-full"
            placeholder="Opsional"
            :disabled="isUpdatingStatus"
          />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isUpdatingStatus"
            @click="closeStatusConfirmation"
          />
          <UButton
            :label="confirmationOperation === 'ROLLBACK' ? 'Rollback' : 'Lanjutkan'"
            :color="confirmationOperation === 'ROLLBACK' ? 'error' : 'primary'"
            :loading="isUpdatingStatus"
            :disabled="isUpdatingStatus"
            @click="confirmStatusChange"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
