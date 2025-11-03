<script setup lang="ts">
import { formatters } from 'date-fns';
import type { Period, Range, Stat } from '~/types'

const props = defineProps<{
  period: Period
  range: Range
}>()

function formatCurrency(value: number): string {
  return value.toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  })
}

const baseStats = [
  {
    title: 'PPM',
    icon: 'i-lucide-chart-pie',
    value: 495,
    percentage: 10,
    type: 0
  },
  {
    title: 'F-Cost',
    icon: 'i-lucide-circle-dollar-sign',
    value: 1170000,
    percentage: -7,
    formatter: formatCurrency,
    type: 0
  },
  {
    title: 'Sales',
    icon: 'i-lucide-shopping-cart',
    value: 137000000,
    percentage: -6,
    formatter: formatCurrency,
    type: 1
  },
  {
    title: 'Models',
    icon: 'i-lucide-monitor',
    value: 7,
    percentage: 12,
    type: 1
  }
]

const { data: stats } = await useAsyncData<Stat[]>(
  'stats',
  async () => {
    return baseStats.map((stat) => {
      return {
        title: stat.title,
        icon: stat.icon,
        value: stat.formatter ? stat.formatter(stat.value) : stat.value,
        variation: stat.percentage,
        type: stat.type,
      }
    })
  },
  {
    watch: [() => props.period, () => props.range],
    default: () => []
  }
)
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard v-for="(stat, index) in stats" :icon="stat.icon" :key="index" :title="stat.title" to="/customers"
      variant="subtle" :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading:
          'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-bold text-muted text-xs uppercase'
      }" class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1">
      <div class="flex items-center gap-2">
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>
      </div>
      <div>
        <div>
          <UBadge v-if="stat.type === 0" :color="stat.variation > 0 ? 'error' : 'success'" variant="subtle"
            class="text-xs">
            {{ stat.variation > 0 ? "+" : "" }}{{ stat.variation }}%
          </UBadge>
          <UBadge v-else :color="stat.variation > 0 ? 'success' : 'error'" variant="subtle" class="text-xs">
            {{ stat.variation > 0 ? "+" : "" }}{{ stat.variation }}%
          </UBadge>
          <span class="text-xs text-muted"> vs last month</span>
        </div>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
