<script setup lang="ts">
import { eachDayOfInterval } from 'date-fns'
import type { Period, Range } from '~/types'

const model = defineModel<Period>({ required: true })

const props = defineProps<{
  range: Range
}>()

const days = computed(() => eachDayOfInterval(props.range))
const periodLabels: Record<Period, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan'
}

const periods = computed(() => {
  let values: Period[]

  if (days.value.length <= 8) {
    values = ['daily']
  } else if (days.value.length <= 31) {
    values = ['daily', 'weekly']
  } else {
    values = ['weekly', 'monthly']
  }

  return values.map(value => ({
    label: periodLabels[value],
    value
  }))
})

// Ensure the model value is always a valid period
watch(periods, () => {
  if (!periods.value.some(period => period.value === model.value)) {
    model.value = periods.value[0]!.value
  }
})
</script>

<template>
  <USelect
    v-model="model"
    :items="periods"
    value-key="value"
    variant="ghost"
    class="data-[state=open]:bg-elevated"
    :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
  />
</template>
