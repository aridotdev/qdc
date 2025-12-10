<script setup lang="ts">
const { data } = useFetch('/api/category', {
  lazy: true
})
</script>

<template>
  <main>
    <div class="text-right mb-4">
      <UButton icon="i-lucide-plus" class="font-bold">Add Category</UButton>
    </div>
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