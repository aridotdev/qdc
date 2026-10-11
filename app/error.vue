<script setup lang="ts">
import type { NuxtError } from '#app'
import { id } from '@nuxt/ui/locale'

defineProps<{
  error: NuxtError
}>()

useSeoMeta({
  title: 'Page not found',
  description: 'We are sorry but this page could not be found.'
})

useHead({
  htmlAttrs: {
    lang: 'id'
  }
})
</script>

<template>
  <UApp :locale="id">
    <UError :error="error" />
  </UApp>
</template>
