<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

const schema = z.object({
  name: z.string('Category name is required').max(20, 'Maximum 25 characters')
})

type Schema = z.output<typeof schema>;

const category = reactive<Partial<Schema>>({
  name: undefined
})

const toast = useToast();
const isOpenModal = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  toast.add({ title: 'Success', description: 'The form has been submitted. ' + category.name?.toUpperCase(), color: 'success' })
  console.log(event.data.name.toUpperCase())
  category.name = undefined;
  isOpenModal.value = !isOpenModal.value
}

const { data } = useFetch('/api/category', {
  lazy: true
})
</script>

<template>
  <main>
    <UModal v-model:open="isOpenModal" title="Add New Category" :dismissible="false" :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full'
    }">
      <div class="text-right mb-4">
        <UButton icon="i-lucide-plus" label="Add category" color="primary" variant="subtle" />
      </div>

      <template #body>
        <UForm :schema="schema" :state="category" class="flex items-end gap-1 mb-4" @submit="onSubmit">
          <UFormField label="Category Name" name="name" class="flex-1">
            <UInput v-model="category.name" class="w-full" />
          </UFormField>

          <UButton type="submit">
            Submit
          </UButton>
        </UForm>
      </template>
    </UModal>



    <div class="border border-b border-default rounded-lg p-2">
      <UTable :data="data" class="shrink-0" :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default'
      }" />
    </div>
  </main>
</template>