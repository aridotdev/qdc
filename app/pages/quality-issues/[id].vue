<script setup lang="ts">
import {
  ATTACHMENT_MIME_TYPE,
  ATTACHMENT_SIZE_LIMIT_BYTES,
  ERROR_CODES,
  QUALITY_ISSUE_DETAIL_ACTION,
  QUALITY_ISSUE_STATUS,
  USER_ROLE,
  type QualityIssueStatus
} from '#shared'
import { formatIndonesianDate, formatIndonesianDateTime } from '~/utils/date'

interface QualityIssueAttachment {
  id: number
  publicId: string
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
  usagePeriod: string | null
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
type ProgressModalMode = 'CREATE' | 'EDIT'

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
const initialEvidence = computed(() => details.value.find(
  detail => detail.action === QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE
))
const progressDetails = computed(() => details.value.filter(
  detail => detail.action !== QUALITY_ISSUE_DETAIL_ACTION.INITIAL_EVIDENCE
))

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
const isAwaitingFirstProgress = computed(() => issue.value?.status === QUALITY_ISSUE_STATUS.OPEN
  && progressDetails.value.length === 0)
const canForward = computed(() => nextStatus.value !== undefined && !isAwaitingFirstProgress.value)
const canRollback = computed(() => isAdmin.value && previousStatus.value !== undefined)

const progressModalOpen = ref(false)
const progressModalMode = ref<ProgressModalMode>('CREATE')
const editingProgressId = ref<number | null>(null)
const progressAttachments = ref<File[]>([])
const existingProgressAttachments = ref<QualityIssueAttachment[]>([])
const removedProgressAttachmentIds = ref<number[]>([])
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

const deleteProgressModalOpen = ref(false)
const progressToDelete = ref<QualityIssueDetail | null>(null)
const deleteProgressError = ref('')
const isDeletingProgress = ref(false)

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

const visibleProgressAttachments = computed(() => existingProgressAttachments.value.filter(
  attachment => !removedProgressAttachmentIds.value.includes(attachment.id)
))
const progressModalTitle = computed(() => progressModalMode.value === 'EDIT'
  ? 'Edit progress'
  : 'Tambah progress')
const progressModalDescription = computed(() => progressModalMode.value === 'EDIT'
  ? 'Perbarui data progress dan attachment pendukung.'
  : 'Catat action terbaru dan lampiran pendukung.')

function getProgressMenuItems(detail: QualityIssueDetail) {
  const items: Array<{
    label: string
    icon: string
    color?: 'error'
    disabled?: boolean
    onSelect: () => void
  }> = [{
    label: 'Edit',
    icon: 'i-lucide-pencil',
    onSelect: () => openEditProgress(detail)
  }]

  if (isAdmin.value) {
    items.push({
      label: 'Hapus',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      disabled: isDeletingProgress.value,
      onSelect: () => openDeleteProgress(detail)
    })
  }

  return [items]
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

function attachmentUrl(attachmentPublicId: string): string {
  return `/api/attachments/${encodeURIComponent(attachmentPublicId)}`
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

function resetProgressForm(): void {
  progressModalMode.value = 'CREATE'
  editingProgressId.value = null
  progressState.action = ''
  progressState.remark = ''
  progressAttachments.value = []
  existingProgressAttachments.value = []
  removedProgressAttachmentIds.value = []
  progressError.value = ''
}

function openCreateProgress(): void {
  resetProgressForm()
  progressModalOpen.value = true
}

function openEditProgress(detail: QualityIssueDetail): void {
  progressModalMode.value = 'EDIT'
  editingProgressId.value = detail.id
  progressState.action = detail.action
  progressState.remark = detail.remark ?? ''
  progressAttachments.value = []
  existingProgressAttachments.value = detail.attachments
  removedProgressAttachmentIds.value = []
  progressError.value = ''
  progressModalOpen.value = true
}

function closeProgressModal(): void {
  if (isSubmittingProgress.value) return

  progressModalOpen.value = false
}

function removeProgressAttachment(attachmentId: number): void {
  if (!removedProgressAttachmentIds.value.includes(attachmentId)) {
    removedProgressAttachmentIds.value.push(attachmentId)
  }
}

function openDeleteProgress(detail: QualityIssueDetail): void {
  progressToDelete.value = detail
  deleteProgressError.value = ''
  deleteProgressModalOpen.value = true
}

function closeDeleteProgress(): void {
  if (isDeletingProgress.value) return

  deleteProgressModalOpen.value = false
  progressToDelete.value = null
  deleteProgressError.value = ''
}

async function confirmDeleteProgress(): Promise<void> {
  const detail = progressToDelete.value

  if (!detail || isDeletingProgress.value) return

  isDeletingProgress.value = true
  deleteProgressError.value = ''

  try {
    await $fetch(`${detailsUrl.value}/${detail.id}`, { method: 'DELETE' })
    deleteProgressModalOpen.value = false
    progressToDelete.value = null
    deleteProgressError.value = ''
    toast.add({
      title: 'Progress berhasil dihapus',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    await refreshData()
  } catch (error) {
    deleteProgressError.value = errorMessage(
      error,
      'Progress gagal dihapus. Silakan coba lagi.'
    )
  } finally {
    isDeletingProgress.value = false
  }
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
    const isEditing = progressModalMode.value === 'EDIT'

    if (isEditing && editingProgressId.value === null) {
      progressError.value = 'Progress yang akan diedit tidak ditemukan.'
      return
    }

    const formData = new FormData()
    formData.append('action', progressState.action.trim())

    if (progressModalMode.value === 'EDIT' || progressState.remark.trim()) {
      formData.append('remark', progressState.remark.trim())
    }

    if (progressModalMode.value === 'EDIT' && removedProgressAttachmentIds.value.length) {
      formData.append(
        'remove_attachment_ids',
        JSON.stringify(removedProgressAttachmentIds.value)
      )
    }

    for (const file of progressAttachments.value) {
      formData.append('attachment', file)
    }

    await $fetch(isEditing
      ? `${detailsUrl.value}/${editingProgressId.value}`
      : detailsUrl.value, {
      method: isEditing ? 'PATCH' : 'POST',
      body: formData
    })

    resetProgressForm()
    progressModalOpen.value = false
    toast.add({
      title: isEditing ? 'Progress berhasil diperbarui' : 'Progress berhasil ditambahkan',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    await refreshData()
  } catch (error) {
    progressError.value = errorMessage(
      error,
      progressModalMode.value === 'EDIT'
        ? 'Progress gagal diperbarui. Silakan coba lagi.'
        : 'Progress gagal ditambahkan. Silakan coba lagi.'
    )
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

function resetStatusConfirmation(): void {
  confirmationOpen.value = false
  confirmationOperation.value = null
  rollbackReason.value = ''
  statusError.value = ''
}

function closeStatusConfirmation(): void {
  if (isUpdatingStatus.value) return

  resetStatusConfirmation()
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
    resetStatusConfirmation()
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
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            to="/quality-issues"
            color="primary"
            variant="soft"
            icon="i-lucide-arrow-left"
            label="Back"
            aria-label="Back to Quality Issues List"
          />
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

      <div v-else-if="issue" class="space-y-4 w-7xl mx-auto">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex gap-3">
              <p class="font-bold text-primary">
                {{ issue.businessId ?? issue.publicId }}
              </p>
              <UBadge
                :color="statusColors[issue.status]"
                variant="subtle"
                class="capitalize"
              >
                {{ formatStatus(issue.status) }}
              </UBadge>
            </div>
            <h1 class="mt-1 text-2xl font-semibold text-highlighted">
              {{ issue.issueName }}
            </h1>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="canForward"
              :label="`Lanjut ke ${formatStatus(nextStatus!)}`"
              icon="i-lucide-arrow-right"
              variant="solid"
              color="success"
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
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Informasi Quality Issue
              </h2>
            </template>

            <dl class="grid gap-4 sm:grid-cols-2 text-sm">
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
                  Notification number
                </dt>
                <dd class="mt-1 text-sm">
                  {{ issue.notificationNumber || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  Usage period
                </dt>
                <dd class="mt-1 text-sm">
                  {{ issue.usagePeriod || '—' }}
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
                <p class="text-xs text-muted">
                  Detail
                </p>
                <p class="mt-1 whitespace-pre-wrap">
                  {{ issue.detail }}
                </p>
              </div>
              <div class="sm:col-span-2">
                <p class="text-xs text-muted">
                  Keterangan
                </p>
                <p class="mt-1 whitespace-pre-wrap">
                  {{ issue.keterangan || '—' }}
                </p>
              </div>
              <div v-if="initialEvidence" class="sm:col-span-2">
                <dd class="mt-1 space-y-3">
                  <p class="text-xs text-muted">
                    Attachments
                  </p>
                  <p v-if="initialEvidence.remark" class="whitespace-pre-wrap text-sm text-muted">
                    {{ initialEvidence.remark }}
                  </p>

                  <div v-if="initialEvidence.attachments.length" class="space-y-2">
                    <div
                      v-for="attachment in initialEvidence.attachments"
                      :key="attachment.id"
                    >
                      <UButton
                        :to="attachmentUrl(attachment.publicId)"
                        :label="attachment.fileName"
                        target="_blank"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        icon="i-lucide-paperclip"
                        class="rounded-md border border-default px-3 py-2"
                      />
                    </div>
                  </div>
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard
            class="flex min-h-0 max-h-[calc(100dvh-var(--ui-header-height)-8rem)] flex-col overflow-hidden sm:col-span-2"
            :ui="{ body: 'min-h-0 flex-1 overflow-y-auto' }"
          >
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 class="font-semibold text-highlighted">
                    Timeline
                  </h2>
                  <p class="text-sm text-muted">
                    Riwayat progress Quality Issue.
                  </p>
                </div>
                <UButton
                  label="Tambah progress"
                  icon="i-lucide-plus"
                  variant="solid"
                  color="primary"
                  class="mt-3"
                  @click="openCreateProgress"
                />

                <UModal
                  v-model:open="progressModalOpen"
                  :title="progressModalTitle"
                  :description="progressModalDescription"
                  :ui="{ content: 'max-w-xl' }"
                  :dismissible="!isSubmittingProgress"
                  :close="!isSubmittingProgress"
                >
                  <template #body>
                    <form class="space-y-4" @submit.prevent="submitProgress">
                      <UAlert
                        v-if="progressError"
                        color="error"
                        variant="subtle"
                        :title="progressModalMode === 'EDIT'
                          ? 'Progress gagal diperbarui'
                          : 'Progress gagal disimpan'"
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

                      <UFormField
                        v-if="progressModalMode === 'EDIT' && existingProgressAttachments.length"
                        label="Attachment saat ini"
                      >
                        <div class="space-y-2">
                          <div
                            v-for="attachment in visibleProgressAttachments"
                            :key="attachment.id"
                            class="flex items-center justify-between gap-2 rounded-md border border-default px-3 py-2"
                          >
                            <UButton
                              :to="attachmentUrl(attachment.publicId)"
                              :label="attachment.fileName"
                              target="_blank"
                              color="neutral"
                              variant="ghost"
                              size="xs"
                              icon="i-lucide-paperclip"
                              class="min-w-0 justify-start"
                            />
                            <UButton
                              type="button"
                              icon="i-lucide-trash-2"
                              color="error"
                              variant="ghost"
                              size="xs"
                              aria-label="Hapus attachment"
                              :disabled="isSubmittingProgress"
                              @click="removeProgressAttachment(attachment.id)"
                            />
                          </div>
                          <p
                            v-if="!visibleProgressAttachments.length"
                            class="text-sm text-muted"
                          >
                            Semua attachment lama akan dihapus.
                          </p>
                        </div>
                      </UFormField>

                      <UFormField label="Attachment baru">
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

                      <div class="flex justify-end gap-2">
                        <UButton
                          type="button"
                          label="Batal"
                          color="neutral"
                          variant="outline"
                          :disabled="isSubmittingProgress"
                          @click="closeProgressModal"
                        />
                        <UButton
                          type="submit"
                          icon="i-lucide-save"
                          :label="progressModalMode === 'EDIT'
                            ? 'Update progress'
                            : 'Simpan progress'"
                          :loading="isSubmittingProgress"
                          :disabled="isSubmittingProgress"
                        />
                      </div>
                    </form>
                  </template>
                </UModal>
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

            <div v-else-if="isTimelineLoading && !progressDetails.length" class="space-y-3">
              <USkeleton class="h-12" />
              <USkeleton class="h-12" />
            </div>

            <div v-else-if="progressDetails.length" class="divide-y divide-default">
              <article
                v-for="detail in progressDetails"
                :key="detail.id"
                class="grid gap-2 py-2 first:pt-0 last:pb-0 md:grid-cols-[6rem_minmax(0,1fr)_6rem] md:items-start md:gap-4"
              >
                <time class="text-xs text-muted md:pt-0.5" :datetime="detail.tanggal">
                  {{ formatIndonesianDateTime(detail.tanggal) }}
                </time>

                <div class="min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="font-medium text-highlighted">
                      {{ detail.action }}
                    </p>
                  </div>
                  <p v-if="detail.remark" class="mt-0.5 whitespace-pre-wrap text-sm text-muted">
                    {{ detail.remark }}
                  </p>
                </div>

                <div class="flex flex-wrap items-center justify-end gap-2">
                  <div v-if="detail.attachments.length" class="flex flex-wrap items-center justify-end gap-1.5">
                    <UTooltip v-for="attachment in detail.attachments" :key="attachment.id" :text="attachment.fileName">
                      <UButton
                        :key="attachment.id"
                        :to="attachmentUrl(attachment.publicId)"
                        icon="i-lucide-paperclip"
                        target="_blank"
                        color="neutral"
                        variant="outline"
                        size="xs"
                        class="max-w-full"
                        :ui="{ label: 'break-all whitespace-normal text-left' }"
                      />
                    </UTooltip>
                  </div>
                  <UDropdownMenu
                    :items="getProgressMenuItems(detail)"
                    :content="{ align: 'end' }"
                  >
                    <UButton
                      icon="i-lucide-ellipsis"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Aksi progress"
                    />
                  </UDropdownMenu>
                </div>
              </article>
            </div>

            <p v-else class="py-6 text-center text-sm text-muted">
              Belum ada progress Quality Issue.
            </p>
          </UCard>
        </div>
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

  <UModal
    v-model:open="deleteProgressModalOpen"
    title="Hapus progress"
    :description="progressToDelete
      ? `Progress ${progressToDelete.action} dan attachment terkait akan dihapus permanen.`
      : 'Progress akan dihapus permanen.'"
    :dismissible="!isDeletingProgress"
    :close="!isDeletingProgress"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="deleteProgressError"
          color="error"
          variant="subtle"
          title="Progress gagal dihapus"
          :description="deleteProgressError"
        />

        <p class="text-sm text-muted">
          Tindakan ini tidak dapat dibatalkan.
        </p>

        <div class="flex justify-end gap-2">
          <UButton
            type="button"
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isDeletingProgress"
            @click="closeDeleteProgress"
          />
          <UButton
            type="button"
            label="Hapus"
            color="error"
            icon="i-lucide-trash-2"
            :loading="isDeletingProgress"
            :disabled="isDeletingProgress"
            @click="confirmDeleteProgress"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
