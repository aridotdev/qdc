<script setup lang="ts">
const { data } = useFetch('/api/category', {
  lazy: true
})
</script>

<template>
  <h1>Category Product Page</h1>
  <UTable :data="data" class="flex-1" />
</template>