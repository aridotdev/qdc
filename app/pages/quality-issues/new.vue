<script setup lang="ts">
import * as z from 'zod'
import { parseDate, type CalendarDate } from '@internationalized/date'
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  ATTACHMENT_MIME_TYPE,
  ATTACHMENT_SIZE_LIMIT_BYTES,
  businessDateSchema,
  ERROR_CODES,
  optionalNullableText,
  requiredText,
  type CreateQualityIssueResponse
} from '#shared'

const toast = useToast()

const attachmentAccept = '.jpg,.jpeg,.png,.pdf,.docx,.xlsx,.mp4'

function emptyToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

const schema = z.object({
  issue_name: requiredText('Nama issue'),
  model_name: requiredText('Model name'),
  serial_number: requiredText('Serial number'),
  tanggal_kejadian: businessDateSchema,
  notification_number: z.preprocess(emptyToUndefined, optionalNullableText('Nomor notifikasi')),
  detail: requiredText('Detail'),
  keterangan: z.preprocess(emptyToUndefined, optionalNullableText('Keterangan'))
})

type Schema = z.output<typeof schema>

const state = reactive({
  issue_name: '',
  model_name: '',
  serial_number: '',
  tanggal_kejadian: '',
  notification_number: '',
  detail: '',
  keterangan: ''
})

const inputDate = useTemplateRef('inputDate')
const datePickerValue = computed<CalendarDate | undefined>({
  get: () => (state.tanggal_kejadian ? parseDate(state.tanggal_kejadian) : undefined),
  set: (value) => {
    state.tanggal_kejadian = value?.toString() ?? ''
  }
})

const attachments = ref<File[]>([])
const attachmentError = ref('')
const submitError = ref('')
const isSubmitting = ref(false)
const form = ref<{ setErrors: (errors: Array<{ name: string, message: string }>) => void }>()

const attachmentPolicies: Record<string, { mimeType: string, maxSize: number }> = {
  jpg: {
    mimeType: ATTACHMENT_MIME_TYPE.JPG,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  jpeg: {
    mimeType: ATTACHMENT_MIME_TYPE.JPEG,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  png: {
    mimeType: ATTACHMENT_MIME_TYPE.PNG,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  pdf: {
    mimeType: ATTACHMENT_MIME_TYPE.PDF,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  docx: {
    mimeType: ATTACHMENT_MIME_TYPE.DOCX,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  xlsx: {
    mimeType: ATTACHMENT_MIME_TYPE.XLSX,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.IMAGE_DOCUMENT
  },
  mp4: {
    mimeType: ATTACHMENT_MIME_TYPE.MP4,
    maxSize: ATTACHMENT_SIZE_LIMIT_BYTES.VIDEO
  }
}

function validateAttachments(files: File[]): string {
  if (files.length === 0) return ''

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

function formatFileSize(size: number): string {
  return size >= 1024 * 1024 ? `${size / (1024 * 1024)} MB` : `${size / 1024} KB`
}

watch(attachments, (files) => {
  attachmentError.value = validateAttachments(files)
})

function getApiError(error: unknown): {
  message: string
  fieldErrors: Record<string, string[]>
  code?: string
} {
  if (!error || typeof error !== 'object') {
    return { message: 'Quality Issue gagal dibuat. Silakan coba lagi.', fieldErrors: {} }
  }

  const response = error as {
    data?: {
      error?: {
        code?: string
        message?: string
        fieldErrors?: Record<string, string[]>
      }
    }
  }
  const body = response.data?.error

  return {
    message: body?.message ?? 'Quality Issue gagal dibuat. Silakan coba lagi.',
    fieldErrors: body?.fieldErrors ?? {},
    code: body?.code
  }
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value) return

  submitError.value = ''
  form.value?.setErrors([])
  attachmentError.value = validateAttachments(attachments.value)

  if (attachmentError.value) return

  isSubmitting.value = true

  try {
    const formData = new FormData()

    for (const [key, value] of Object.entries(event.data)) {
      if (typeof value === 'string' && value.trim()) {
        formData.append(key, value.trim())
      }
    }

    for (const attachment of attachments.value) {
      formData.append('attachment', attachment)
    }

    const result = await $fetch<CreateQualityIssueResponse>('/api/quality-issues', {
      method: 'POST',
      body: formData
    })

    toast.add({
      title: 'Quality Issue berhasil dibuat',
      description: result.businessId ? `ID: ${result.businessId}` : `Public ID: ${result.publicId}`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    await navigateTo(`/quality-issues/${result.publicId}`)
  } catch (error) {
    const apiError = getApiError(error)

    submitError.value = apiError.message

    const fieldErrors = Object.entries(apiError.fieldErrors).flatMap(([name, messages]) =>
      messages.map(message => ({ name, message }))
    )
    form.value?.setErrors(fieldErrors)

    if (
      apiError.code === ERROR_CODES.UNSUPPORTED_FILE_TYPE
      || apiError.code === ERROR_CODES.FILE_TOO_LARGE
    ) {
      attachmentError.value = apiError.message
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="new-quality-issue">
    <template #header>
      <UDashboardNavbar title="New Quality Issue">
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
      <div class="mx-auto w-full max-w-5xl">
        <UAlert
          v-if="submitError"
          color="error"
          variant="subtle"
          title="Quality Issue gagal dibuat"
          :description="submitError"
          class="mb-4"
        />

        <UCard :ui="{ body: 'p-6 sm:p-8' }">
          <UForm
            ref="form"
            :schema="schema"
            :state="state"
            :disabled="isSubmitting"
            class="space-y-6"
            @submit="onSubmit"
          >
            <section>
              <div class="mb-3 flex items-center gap-2">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  class="size-5 justify-center rounded-full p-0 text-[10px]"
                >
                  1
                </UBadge>
                <h2 class="text-xs font-bold uppercase tracking-wider text-muted">
                  Identifikasi Produk & Isu
                </h2>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-6">
                <UFormField
                  label="Nama issue"
                  name="issue_name"
                  required
                  class="md:col-span-3"
                >
                  <UInput
                    v-model="state.issue_name"
                    class="w-full"
                    placeholder="Contoh: Housing retak"
                  />
                </UFormField>

                <UFormField
                  label="Tanggal kejadian"
                  name="tanggal_kejadian"
                  required
                  class="md:col-span-3"
                >
                  <UInputDate
                    ref="inputDate"
                    v-model="datePickerValue"
                    locale="id-ID"
                    class="w-full"
                  >
                    <template #trailing>
                      <UPopover :reference="inputDate?.inputsRef[3]?.$el">
                        <UButton
                          color="neutral"
                          variant="link"
                          size="sm"
                          icon="i-lucide-calendar"
                          aria-label="Pilih tanggal kejadian"
                          class="px-0"
                        />

                        <template #content>
                          <UCalendar v-model="datePickerValue" locale="id-ID" class="p-2" />
                        </template>
                      </UPopover>
                    </template>
                  </UInputDate>
                </UFormField>

                <UFormField
                  label="Notification number"
                  name="notification_number"
                  class="md:col-span-2"
                >
                  <UInput
                    v-model="state.notification_number"
                    class="w-full"
                    placeholder="Opsional"
                  />
                </UFormField>

                <UFormField
                  label="Model name"
                  name="model_name"
                  required
                  class="md:col-span-2"
                >
                  <UInput
                    v-model="state.model_name"
                    class="w-full"
                    placeholder="Contoh: MODEL-01"
                  />
                </UFormField>

                <UFormField
                  label="Serial number"
                  name="serial_number"
                  required
                  class="md:col-span-2"
                >
                  <UInput
                    v-model="state.serial_number"
                    class="w-full"
                    placeholder="Contoh: SN-001"
                  />
                </UFormField>
              </div>
            </section>

            <USeparator />

            <section>
              <div class="mb-3 flex items-center gap-2">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  class="size-5 justify-center rounded-full p-0 text-[10px]"
                >
                  2
                </UBadge>
                <h2 class="text-xs font-bold uppercase tracking-wider text-muted">
                  Deskripsi & Catatan
                </h2>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UFormField label="Detail" name="detail" required>
                  <UTextarea
                    v-model="state.detail"
                    class="w-full"
                    :rows="4"
                    placeholder="Jelaskan masalah yang ditemukan secara spesifik..."
                  />
                </UFormField>

                <UFormField label="Keterangan" name="keterangan">
                  <UTextarea
                    v-model="state.keterangan"
                    class="w-full"
                    :rows="4"
                    placeholder="Informasi tambahan lain jika ada"
                  />
                </UFormField>
              </div>
            </section>

            <USeparator />

            <section>
              <div class="mb-3 flex items-center gap-2">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  class="size-5 justify-center rounded-full p-0 text-[10px]"
                >
                  3
                </UBadge>
                <h2 class="text-xs font-bold uppercase tracking-wider text-muted">
                  Lampiran Berkas
                </h2>
              </div>

              <UFormField label="Attachment" :error="attachmentError || undefined">
                <UFileUpload
                  v-model="attachments"
                  position="inside"
                  layout="list"
                  multiple
                  label="Pilih atau seret file ke sini"
                  description="JPG, PNG, PDF, DOCX, XLSX maksimal 1 MB | MP4 maksimal 10 MB"
                  :accept="attachmentAccept"
                  :disabled="isSubmitting"
                  class="w-full"
                  :ui="{
                    base: 'min-h-40'
                  }"
                />
              </UFormField>
            </section>

            <div class="flex flex-wrap items-center justify-end gap-3 border-t border-default pt-5">
              <UButton
                to="/quality-issues"
                color="neutral"
                variant="outline"
                :disabled="isSubmitting"
              >
                Cancel
              </UButton>
              <UButton
                type="submit"
                icon="i-lucide-save"
                :loading="isSubmitting"
                :disabled="isSubmitting"
              >
                Create Quality Issue
              </UButton>
            </div>
          </UForm>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
