<template>
  <ToolChart
    :width="WIDTH"
    :height="HEIGHT"
    :aria-label="ariaLabel"
    figure-class="pt-2"
    caption-class="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-ink-gray-5"
  >
    <!-- Loss region (left of break-even) and profit region (right), shaded subtly. -->
    <polygon :points="lossRegion" class="text-ink-red-3" fill="currentColor" opacity="0.08" />
    <polygon :points="profitRegion" class="text-ink-green-3" fill="currentColor" opacity="0.1" />

    <!-- Axis baselines. -->
    <line
      :x1="x(0)"
      :y1="y(0)"
      :x2="x(qMax)"
      :y2="y(0)"
      class="stroke-outline-gray-2"
      stroke-width="1"
    />

    <polyline
      :points="costLine"
      fill="none"
      class="text-ink-gray-7"
      stroke="currentColor"
      stroke-width="2"
      vector-effect="non-scaling-stroke"
    />
    <!-- Step 8, as on the cost line above it. A line that carries meaning is a non-text
         element and owes 3:1; step 3 measures 1.21:1 and is the region tint below. -->
    <polyline
      :points="revenueLine"
      fill="none"
      class="text-ink-green-8"
      stroke="currentColor"
      stroke-width="2"
      vector-effect="non-scaling-stroke"
    />

    <line
      :x1="crossover.x"
      :y1="crossover.y"
      :x2="crossover.x"
      :y2="y(0)"
      class="stroke-outline-gray-3"
      stroke-width="1"
      stroke-dasharray="3 3"
    />
    <circle :cx="crossover.x" :cy="crossover.y" r="3.5" class="text-ink-gray-9" fill="currentColor" />

    <template #caption>
      <span class="flex items-center gap-1.5">
        <span class="h-0.5 w-3 rounded bg-ink-green-8" aria-hidden="true" />
        Revenue
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-0.5 w-3 rounded bg-ink-gray-7" aria-hidden="true" />
        Total cost
      </span>
      <span class="ml-auto font-medium text-ink-gray-7">
        Break-even {{ breakEvenQuantity.toLocaleString() }} units
      </span>
    </template>
  </ToolChart>
</template>

<script setup>
import { computed } from 'vue'

import ToolChart from '@/components/charts/ToolChart.vue'

const WIDTH = 320
const HEIGHT = 150
const PAD = { top: 10, right: 10, bottom: 14, left: 10 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom

const props = defineProps({
  fixedCost: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  variableCost: { type: Number, required: true },
  exactQuantity: { type: Number, required: true },
  breakEvenQuantity: { type: Number, required: true },
  ariaLabel: { type: String, default: 'Cost versus revenue break-even chart' },
})

// Extend the axis past break-even so the crossover sits comfortably inside the plot.
const qMax = computed(() =>
  Math.max(Math.ceil(props.exactQuantity * 1.9), props.breakEvenQuantity + 1, 1),
)

function revenueAt(quantity) {
  return props.sellingPrice * quantity
}

function costAt(quantity) {
  return props.fixedCost + props.variableCost * quantity
}

const yMax = computed(() => Math.max(revenueAt(qMax.value), costAt(qMax.value), 1))

function x(quantity) {
  return PAD.left + (quantity / qMax.value) * PLOT_W
}

function y(value) {
  return PAD.top + (1 - value / yMax.value) * PLOT_H
}

const revenueLine = computed(() => `${x(0)},${y(0)} ${x(qMax.value)},${y(revenueAt(qMax.value))}`)
const costLine = computed(
  () => `${x(0)},${y(props.fixedCost)} ${x(qMax.value)},${y(costAt(qMax.value))}`,
)

const crossover = computed(() => ({
  x: x(props.exactQuantity),
  y: y(revenueAt(props.exactQuantity)),
}))

const profitRegion = computed(() => {
  const q = props.exactQuantity
  return `${x(q)},${y(revenueAt(q))} ${x(qMax.value)},${y(revenueAt(qMax.value))} ${x(qMax.value)},${y(costAt(qMax.value))}`
})

const lossRegion = computed(() => {
  const q = props.exactQuantity
  return `${x(0)},${y(props.fixedCost)} ${x(q)},${y(revenueAt(q))} ${x(0)},${y(0)}`
})
</script>
