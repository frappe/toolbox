<template>
  <ToolChart
    v-if="points.length > 1"
    :width="WIDTH"
    :height="HEIGHT"
    :aria-label="ariaLabel"
    figure-class="pt-2"
    svg-class="text-ink-gray-8"
    caption-class="flex justify-between pt-1 text-xs text-ink-gray-5"
    stretch
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

    <template #caption>
      <span>Year {{ formatYear(series[0].year) }}</span>
      <span>Year {{ formatYear(series.at(-1).year) }}</span>
    </template>
  </ToolChart>
</template>

<script setup>
import { computed } from 'vue'

import ToolChart from '@/components/charts/ToolChart.vue'
import { areaPolygon, polylinePoints, scalePoints, seriesBounds } from '@/components/charts/seriesPath'

const WIDTH = 320
const HEIGHT = 96
// The line is 2px wide, so the plot is inset by half of it top and bottom. Without this the
// stroke is clipped at the extremes.
const PADDING = { top: 2, right: 0, bottom: 2, left: 0 }

const props = defineProps({
  series: { type: Array, required: true },
  ariaLabel: { type: String, default: 'Growth over time' },
})

const values = computed(() =>
  props.series.filter((point) => Number.isFinite(point.value)).map((point) => point.value),
)

const points = computed(() =>
  values.value.length > 1
    ? scalePoints(values.value, {
        width: WIDTH,
        height: HEIGHT,
        padding: PADDING,
        // Money over time is read against nothing, so the baseline is zero: growth from 100 to
        // 110 is a gentle rise rather than the cliff its own range would draw.
        bounds: seriesBounds(values.value, { anchorAtZero: true }),
      })
    : [],
)

const linePoints = computed(() => polylinePoints(points.value))
const areaPoints = computed(() =>
  areaPolygon(points.value, { width: WIDTH, height: HEIGHT, padding: { bottom: 0 } }),
)

function formatYear(year) {
  return Number.isInteger(year) ? String(year) : year.toFixed(1)
}
</script>
