<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { QUALITY_ISSUE_STATUS, type QualityIssueStatus } from '#shared'
import {
  type QualityIssueListItem,
  type QualityIssueSortField,
  useQualityIssues
} from '~/composables/useQualityIssues'
import type { Row } from '@tanstack/table-core'
import { formatIndonesianDate } from '~/utils/date'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const NuxtLink = resolveComponent('NuxtLink')
const toast = useToast()

const { data, error, status: requestStatus, refresh, query, updateQuery } = useQualityIssues()
const deleteModalOpen = ref(false)
const issueToDelete = ref<QualityIssueListItem | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')

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
    cell: ({ row }) =>
      h(NuxtLink, {
        to: `/quality-issues/${row.original.publicId}`,
        class: 'inline-block hover:font-bold'
      }, row.original.businessId ?? `#${row.original.id}`),
    meta: { class: { th: 'w-[160px]', td: 'whitespace-nowrap' } }
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
    cell: ({ row }) => 
      h(NuxtLink, {
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
          content: {
            align: 'end'
          },
          items: getRowItems(row),
          'aria-label': 'Actions dropdown'
        },
        () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            'aria-label': 'Actions dropdown'
          })
      )
    }
  }
]

function getRowItems(row: Row<QualityIssueListItem>) {
  return [
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
    {
      label: 'Delete Issue',
      color: 'error',
      icon: 'i-lucide-trash-2',
      onSelect() {
        issueToDelete.value = row.original
        deleteError.value = ''
        deleteModalOpen.value = true
      }
    }
  ]
}

async function confirmDelete() {
  if (!issueToDelete.value) return

  isDeleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/quality-issues/${encodeURIComponent(issueToDelete.value.publicId)}`, {
      method: 'DELETE'
    })
    deleteModalOpen.value = false
    toast.add({ title: 'Issue deleted', description: 'Quality Issue berhasil dihapus.', color: 'success' })
    await refresh()
  } catch (deleteRequestError: unknown) {
    const payload = deleteRequestError as { data?: { message?: string } }
    deleteError.value = payload.data?.message ?? 'Quality Issue gagal dihapus.'
  } finally {
    isDeleting.value = false
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
      <UDashboardNavbar title="Quality Issues">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton to="/quality-issues/new" icon="i-lucide-plus" label="New Quality Issue" />
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
    title="Delete Issue"
    :description="`Hapus ${issueToDelete?.businessId ?? 'Quality Issue'}? Tindakan ini tidak dapat dibatalkan.`"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="deleteError"
          color="error"
          variant="subtle"
          title="Delete gagal"
          :description="deleteError"
        />
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isDeleting"
            @click="deleteModalOpen = false"
          />
          <UButton
            label="Delete Issue"
            color="error"
            :loading="isDeleting"
            :disabled="isDeleting"
            @click="confirmDelete"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
