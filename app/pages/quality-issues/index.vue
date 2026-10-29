<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import {
  QUALITY_ISSUE_STATUS,
  USER_ROLE,
  type QualityIssueStatus,
  type QualityIssueView
} from '#shared'
import {
  type QualityIssueListItem,
  type QualityIssueSortField,
  useQualityIssues
} from '~/composables/useQualityIssues'
import type { Row } from '@tanstack/table-core'
import { formatIndonesianDate } from '~/utils/date'
import NewQualityIssue from '~/components/quality-issues/NewModal.vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const NuxtLink = resolveComponent('NuxtLink')
const toast = useToast()
const { user } = useUserProfile()

const { data, error, status: requestStatus, refresh, query, updateQuery } = useQualityIssues()
const deleteModalOpen = ref(false)
const newModalOpen = ref(false)
const issueToDelete = ref<QualityIssueListItem | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const deleteReason = ref('')
const restoreModalOpen = ref(false)
const issueToRestore = ref<QualityIssueListItem | null>(null)
const isRestoring = ref(false)
const restoreError = ref('')

const searchInput = ref(query.value.search ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => query.value.search,
  (value) => {
    searchInput.value = value ?? ''
  }
)

watch(searchInput, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void updateQuery({ search: value, page: 1 })
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

const statusOptions = [
  { label: 'Semua status', value: undefined },
  { label: 'Open', value: QUALITY_ISSUE_STATUS.OPEN },
  { label: 'In Progress', value: QUALITY_ISSUE_STATUS.IN_PROGRESS },
  { label: 'Monitoring', value: QUALITY_ISSUE_STATUS.MONITORING },
  { label: 'Closed', value: QUALITY_ISSUE_STATUS.CLOSED }
]

const selectedStatus = computed({
  get: () => query.value.status,
  set: (value: QualityIssueStatus | undefined) => {
    void updateQuery({ status: value, page: 1 })
  }
})

const viewOptions = [
  { label: 'Quality Issue aktif', value: 'active' as const },
  { label: 'Quality Issue terhapus', value: 'deleted' as const },
  { label: 'Semua Quality Issue', value: 'all' as const }
]

const selectedView = computed({
  get: () => query.value.view,
  set: (value: QualityIssueView) => {
    void updateQuery({ view: value, page: 1 })
  }
})

const isDeletedView = computed(() => query.value.view === 'deleted')
const isAdmin = computed(() => user.value?.role === USER_ROLE.ADMIN)

const sortLabels: Record<QualityIssueSortField, string> = {
  issueName: 'Issue',
  modelName: 'Model',
  serialNumber: 'Serial number',
  tanggalKejadian: 'Tanggal kejadian',
  notificationNumber: 'Notifikasi',
  status: 'Status',
  createdAt: 'Dibuat'
}

function sortIcon(field: QualityIssueSortField) {
  if (query.value.sortBy !== field) return 'i-lucide-arrow-up-down'
  return query.value.sortDirection === 'asc'
    ? 'i-lucide-arrow-up-narrow-wide'
    : 'i-lucide-arrow-down-wide-narrow'
}

function toggleSort(field: QualityIssueSortField) {
  const direction
    = query.value.sortBy === field && query.value.sortDirection !== 'asc' ? 'asc' : 'desc'

  void updateQuery({ sortBy: field, sortDirection: direction, page: 1 })
}

function sortableHeader(field: QualityIssueSortField) {
  return () =>
    h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      label: sortLabels[field],
      icon: sortIcon(field),
      class: '-mx-2.5',
      onClick: () => toggleSort(field)
    })
}

function statusColor(status: QualityIssueStatus) {
  return {
    [QUALITY_ISSUE_STATUS.OPEN]: 'neutral',
    [QUALITY_ISSUE_STATUS.IN_PROGRESS]: 'info',
    [QUALITY_ISSUE_STATUS.MONITORING]: 'warning',
    [QUALITY_ISSUE_STATUS.CLOSED]: 'success'
  }[status] as 'neutral' | 'info' | 'warning' | 'success'
}

const columns: TableColumn<QualityIssueListItem>[] = [
  {
    accessorKey: 'businessId',
    header: 'ID',
    cell: ({ row }) => row.original.deletedAt
      ? h('span', row.original.businessId ?? `#${row.original.id}`)
      : h(NuxtLink, {
          to: `/quality-issues/${row.original.publicId}`,
          class: 'inline-block hover:font-bold'
        }, row.original.businessId ?? `#${row.original.id}`),
    meta: { class: { th: 'w-[160px]', td: 'whitespace-nowrap' } }
  },
  {
    accessorKey: 'deletedAt',
    header: 'Deleted at',
    cell: ({ row }) => row.original.deletedAt
      ? formatIndonesianDate(row.original.deletedAt)
      : '—',
    meta: { class: { th: 'whitespace-nowrap', td: 'whitespace-nowrap' } }
  },
  {
    accessorKey: 'tanggalKejadian',
    header: sortableHeader('tanggalKejadian'),
    cell: ({ row }) => formatIndonesianDate(row.original.tanggalKejadian),
    meta: { class: { th: 'whitespace-nowrap', td: 'whitespace-nowrap' } }
  },
  {
    accessorKey: 'modelName',
    header: sortableHeader('modelName'),
    meta: { class: { th: 'whitespace-nowrap', td: 'whitespace-nowrap' } }
  },
  {
    accessorKey: 'issueName',
    header: sortableHeader('issueName'),
    cell: ({ row }) => row.original.deletedAt
      ? h('span', row.original.issueName)
      : h(NuxtLink, {
          to: `/quality-issues/${row.original.publicId}`,
          class: 'hover:underline'
        }, row.original.issueName),
    meta: { class: { th: 'w-[45%]', td: 'min-w-0 text-primary' } }
  },
  {
    accessorKey: 'status',
    header: sortableHeader('status'),
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color: statusColor(row.original.status),
          variant: 'subtle',
          class: 'capitalize'
        },
        () => row.original.status.replace('_', ' ').toLowerCase()
      ),
    meta: { class: { th: 'whitespace-nowrap', td: 'whitespace-nowrap' } }
  },
  {
    id: 'actions',
    meta: {
      class: {
        td: 'text-right'
      }
    },
    cell: ({ row }) => {
      return h(
        UDropdownMenu,
        {
          'content': {
            align: 'end'
          },
          'items': getRowItems(row),
          'aria-label': 'Actions dropdown'
        },
        () =>
          h(UButton, {
            'icon': 'i-lucide-ellipsis-vertical',
            'color': 'neutral',
            'variant': 'ghost',
            'aria-label': 'Actions dropdown'
          })
      )
    }
  }
]

interface IssueActionItem {
  type?: 'label'
  label: string
  icon?: string
  color?: 'error'
  onSelect?: () => void
}

function getRowItems(row: Row<QualityIssueListItem>): IssueActionItem[] {
  if (row.original.deletedAt) {
    return [
      {
        type: 'label',
        label: 'Actions'
      },
      {
        label: 'Restore Issue',
        icon: 'i-lucide-rotate-ccw',
        onSelect() {
          issueToRestore.value = row.original
          restoreError.value = ''
          restoreModalOpen.value = true
        }
      }
    ]
  }

  const items: IssueActionItem[] = [
    {
      type: 'label',
      label: 'Actions'
    },
    {
      label: 'View Detail',
      icon: 'i-lucide-book-open-text',
      onSelect() {
        navigateTo(`/quality-issues/${row.original.publicId}`)
      }
    },
  ]

  if (isAdmin.value) {
    items.push({
      label: 'Archive Issue',
      color: 'error',
      icon: 'i-lucide-trash-2',
      onSelect() {
        issueToDelete.value = row.original
        deleteError.value = ''
        deleteReason.value = ''
        deleteModalOpen.value = true
      }
    })
  }

  return items
}

async function confirmDelete() {
  if (!issueToDelete.value) return

  isDeleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/quality-issues/${encodeURIComponent(issueToDelete.value.publicId)}`, {
      method: 'DELETE',
      body: deleteReason.value.trim() ? { reason: deleteReason.value.trim() } : {}
    })
    deleteModalOpen.value = false
    toast.add({ title: 'Issue diarsipkan', description: 'Quality Issue berhasil di-soft delete.', color: 'success' })
    await refresh()
  } catch (deleteRequestError: unknown) {
    const payload = deleteRequestError as { data?: { message?: string } }
    deleteError.value = payload.data?.message ?? 'Quality Issue gagal dihapus.'
  } finally {
    isDeleting.value = false
  }
}

async function confirmRestore() {
  if (!issueToRestore.value || isRestoring.value) return

  isRestoring.value = true
  restoreError.value = ''

  try {
    await $fetch(`/api/quality-issues/${encodeURIComponent(issueToRestore.value.publicId)}/restore`, {
      method: 'POST'
    })
    restoreModalOpen.value = false
    issueToRestore.value = null
    toast.add({ title: 'Issue dipulihkan', description: 'Quality Issue kembali aktif.', color: 'success' })
    await refresh()
  } catch (restoreRequestError: unknown) {
    const payload = restoreRequestError as { data?: { error?: { message?: string }, message?: string } }
    restoreError.value = payload.data?.error?.message ?? payload.data?.message ?? 'Quality Issue gagal dipulihkan.'
  } finally {
    isRestoring.value = false
  }
}

const isLoading = computed(() => requestStatus.value === 'pending')
const hasError = computed(() => requestStatus.value === 'error')
const errorMessage = computed(() => {
  const payload = error.value?.data as
    { message?: string, error?: { message?: string } } | undefined
  return (
    payload?.error?.message ?? payload?.message ?? 'Quality Issue gagal dimuat. Silakan coba lagi.'
  )
})
</script>

<template>
  <UDashboardPanel id="quality-issues">
    <template #header>
      <UDashboardNavbar :title="isDeletedView ? 'Deleted Quality Issues' : 'Quality Issues'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <USelect
            v-model="selectedView"
            :items="viewOptions"
            value-key="value"
            class="min-w-52"
            aria-label="Tampilan Quality Issue"
          />
          <UButton
            v-if="!isDeletedView"
            icon="i-lucide-plus"
            label="New Quality Issue"
            @click="newModalOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-7xl flex-col">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <UInput
            v-model="searchInput"
            class="min-w-2xs"
            icon="i-lucide-search"
            placeholder="Cari quality issue..."
            aria-label="Cari quality issue"
          />

          <USelect
            v-model="selectedStatus"
            :items="statusOptions"
            value-key="value"
            class="min-w-40"
            placeholder="Filter status"
            aria-label="Filter status"
          />
        </div>

        <UAlert
          v-if="hasError"
          class="mt-4"
          color="error"
          variant="subtle"
          title="Data gagal dimuat"
          :description="errorMessage"
        >
          <template #actions>
            <UButton
              label="Coba lagi"
              color="error"
              variant="outline"
              @click="refresh()"
            />
          </template>
        </UAlert>

        <UTable
          class="mt-4 shrink-0"
          :data="data?.items ?? []"
          :columns="columns"
          :loading="isLoading"
          :empty="
            query.search || query.status
              ? 'Tidak ada Quality Issue yang sesuai.'
              : isDeletedView
                ? 'Belum ada Quality Issue yang dihapus.'
                : 'Belum ada Quality Issue.'
          "
          :ui="{
            base: 'table-auto border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
            td: 'border-b border-default'
          }"
        />

        <div
          class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4"
        >
          <p class="text-sm text-muted">
            {{ data?.meta.total ?? 0 }} Quality Issue
          </p>
          <UPagination
            :page="query.page"
            :items-per-page="query.limit"
            :total="data?.meta.total ?? 0"
            @update:page="(page: number) => updateQuery({ page })"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="deleteModalOpen"
    title="Archive Issue"
    :description="`Arsipkan ${issueToDelete?.businessId ?? 'Quality Issue'}? Data tetap dapat dipulihkan oleh Admin.`"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="deleteError"
          color="error"
          variant="subtle"
          title="Archive gagal"
          :description="deleteError"
        />
        <UFormField label="Alasan penghapusan (opsional)">
          <UTextarea
            v-model="deleteReason"
            class="w-full"
            :rows="3"
            placeholder="Contoh: Duplikasi laporan"
            :disabled="isDeleting"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isDeleting"
            @click="deleteModalOpen = false"
          />
          <UButton
            label="Archive Issue"
            color="error"
            :loading="isDeleting"
            :disabled="isDeleting"
            @click="confirmDelete"
          />
        </div>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="restoreModalOpen"
    title="Restore Issue"
    :description="`Pulihkan ${issueToRestore?.businessId ?? 'Quality Issue'}? Data dan relasinya akan kembali ke daftar aktif.`"
    :dismissible="!isRestoring"
    :close="!isRestoring"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="restoreError"
          color="error"
          variant="subtle"
          title="Restore gagal"
          :description="restoreError"
        />
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isRestoring"
            @click="restoreModalOpen = false"
          />
          <UButton
            label="Restore Issue"
            color="primary"
            :loading="isRestoring"
            :disabled="isRestoring"
            @click="confirmRestore"
          />
        </div>
      </div>
    </template>
  </UModal>

  <NewQualityIssue v-model:open="newModalOpen" />
</template>
