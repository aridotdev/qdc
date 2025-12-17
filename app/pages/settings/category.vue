<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'

// ------- form section -------------
const schema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Category name is required')
    .max(20, 'Maximum 20 characters')
})

type Schema = z.output<typeof schema>

const category = reactive<Partial<Schema>>({
  name: undefined
})

const toast = useToast()
const isOpenModal = ref(false)
const isSubmitting = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSubmitting.value = true
  try {
    const response = await $fetch('/api/category', {
      method: 'POST',
      body: event.data
    })

    if (response.success) {
      toast.add({
        title: 'Success',
        description: response.message || 'Category created successfully',
        color: 'success'
      })
      isOpenModal.value = false
      await refresh()
      category.name = ''
    }
  } catch (error: any) {
    const errMessage = error.data?.message || 'Error creating new category'
    toast.add({
      title: 'Warning',
      description: errMessage,
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
// ------- /form section -------------

// ------- DataTable section -------------
const { data, refresh } = await useFetch('/api/category', {
  lazy: true,
  key: 'categories-fetch-key'
})

type Category = {
  id: number
  name: string
}

const columns: TableColumn<Category>[] = [
  {
    accessorKey: 'id',
    // header: 'ID',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'ID',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    }
  },
  {
    accessorKey: 'name',
    header: 'Category Name',
    cell: ({ row }) => {
      return String(row.getValue('name') ?? '').toUpperCase()
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: ({ row }) => {
      return new Date(row.getValue('createdAt')).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      })
    }
  }
]
// ------- /DataTable section -------------
</script>

<template>
  <main>
    <div class="text-right mb-4">
      <UButton
        icon="i-lucide-plus"
        label="Add category"
        color="primary"
        variant="subtle"
        @click.prevent="isOpenModal = true"
      />
    </div>
    <UModal
      v-model:open="isOpenModal"
      title="Add New Category"
      :dismissible="false"
      :close="{ color: 'primary', variant: 'outline', class: 'rounded-full' }"
    >
      <template #body>
        <UForm
          :schema="schema"
          :state="category"
          class="space-y-2"
          @submit="onSubmit"
        >
          <UFormField label="Category Name" name="name" class="flex-1">
            <UInput v-model="category.name" class="w-full" autofocus />
          </UFormField>

          <div class="mt-4 text-right">
            <UButton type="submit" :loading="isSubmitting">
              Submit
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <div class="border border-b border-default rounded-lg p-2">
      <UTable
        :data="data?.data"
        :columns="columns"
        class="shrink-0"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default'
        }"
      />
    </div>
  </main>
</template>
