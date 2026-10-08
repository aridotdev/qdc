<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { QUALITY_ISSUE_STATUS, type QualityIssueStatus } from '#shared'
import {
  type QualityIssueListItem,
  type QualityIssueSortField,
  useQualityIssues
} from '~/composables/useQualityIssues'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const { data, error, status: requestStatus, refresh, query, updateQuery } = useQualityIssues()

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
  { accessorKey: 'id', header: 'ID', cell: ({ row }) => `#${row.original.id}` },
  {
    accessorKey: 'issueName',
    header: sortableHeader('issueName'),
    cell: ({ row }) => row.original.issueName
  },
  { accessorKey: 'modelName', header: sortableHeader('modelName') },
  { accessorKey: 'serialNumber', header: sortableHeader('serialNumber') },
  {
    accessorKey: 'tanggalKejadian',
    header: sortableHeader('tanggalKejadian'),
    cell: ({ row }) =>
      new Date(`${row.original.tanggalKejadian}T00:00:00`).toLocaleDateString('id-ID')
  },
  {
    accessorKey: 'notificationNumber',
    header: sortableHeader('notificationNumber'),
    cell: ({ row }) => row.original.notificationNumber ?? '—'
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
      )
  }
]

const isLoading = computed(() => requestStatus.value === 'pending')
const hasError = computed(() => requestStatus.value === 'error')
const errorMessage = computed(() => {
  const payload = error.value?.data as
    { message?: string, error?: { message?: string } } | undefined
  return (
    payload?.error?.message ?? payload?.message ?? 'Quality Issue gagal dimuat. Silakan coba lagi.'
  )
})

function openDetail(_: Event, row: { original: QualityIssueListItem }) {
  return navigateTo(`/quality-issues/${row.original.id}`)
}
</script>

<template>
  <UDashboardPanel id="quality-issues">
    <template #header>
      <UDashboardNavbar title="Quality Issues">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UInput
          v-model="searchInput"
          class="max-w-sm"
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
        :on-select="openDetail"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
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
    </template>
  </UDashboardPanel>
</template>
