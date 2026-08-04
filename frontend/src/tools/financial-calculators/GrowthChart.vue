<template>
  <figure v-if="scaled.length > 1" class="pt-2">
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="w-full text-ink-gray-8"
      role="img"
      :aria-label="ariaLabel"
      preserveAspectRatio="none"
    >
      <polygon :points="areaPoints" fill="currentColor" class="opacity-10" />
      <polyline
        :points="linePoints"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <figcaption class="flex justify-between pt-1 text-xs text-ink-gray-5">
      <span>Year {{ formatYear(series[0].year) }}</span>
      <span>Year {{ formatYear(series.at(-1).year) }}</span>
    </figcaption>
  </figure>
</template>

<script setup>
import { computed } from 'vue'

const WIDTH = 320
const HEIGHT = 96

const props = defineProps({
  series: { type: Array, required: true },
  ariaLabel: { type: String, default: 'Growth over time' },
})

const scaled = computed(() => {
  const points = props.series.filter((point) => Number.isFinite(point.value))
  if (points.length < 2) return []
  const values = points.map((point) => point.value)
  const min = Math.min(0, ...values) // baseline at zero so growth reads honestly
  const span = Math.max(...values) - min || 1
  return points.map((point, index) => ({
    x: (index / (points.length - 1)) * WIDTH,
    y: HEIGHT - 2 - ((point.value - min) / span) * (HEIGHT - 4),
  }))
})

const linePoints = computed(() =>
  scaled.value.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
)

const areaPoints = computed(() =>
  scaled.value.length ? `0,${HEIGHT} ${linePoints.value} ${WIDTH},${HEIGHT}` : '',
)

function formatYear(year) {
  return Number.isInteger(year) ? String(year) : year.toFixed(1)
}
</script>
