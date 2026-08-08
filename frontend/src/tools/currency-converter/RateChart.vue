<template>
  <section
    class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6"
    aria-labelledby="rate-chart-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="rate-chart-heading" class="text-lg font-semibold text-ink-gray-9">Rate history</h2>
        <p class="pt-1 text-sm text-ink-gray-6">
          {{ base }} → {{ quote }} · dated ECB reference rates
        </p>
      </div>
      <div v-if="state === 'ready'" class="text-right">
        <p class="text-xl font-semibold tabular-nums text-ink-gray-9">
          {{ formatRate(latest.value) }}
        </p>
        <p
          class="text-sm tabular-nums"
          :class="change.direction === 'down' ? 'text-ink-red-3' : 'text-ink-green-3'"
        >
          {{ change.direction === 'down' ? '▼' : '▲' }} {{ formatRate(Math.abs(change.absolute)) }}
          ({{ change.percent }})
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 pt-4">
      <div class="overflow-x-auto">
        <TabButtons
          :model-value="range"
          :options="rangeTabs"
          size="md"
          aria-label="Chart range"
          @update:model-value="emit('set-range', $event)"
        />
      </div>
      <Button
        v-if="state === 'ready'"
        class="ml-auto h-8"
        label="Download CSV"
        variant="ghost"
        icon-left="lucide-download"
        @click="downloadCsv"
      />
    </div>

    <div class="pt-5">
      <div
        v-if="state === 'loading'"
        class="flex h-56 items-center justify-center rounded-xl bg-surface-gray-2"
        role="status"
      >
        <LoadingText text="Loading rate history…" />
      </div>

      <div
        v-else-if="state === 'error'"
        class="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-surface-gray-2 text-center"
        role="alert"
      >
        <p class="text-sm text-ink-gray-7">{{ errorMessage || 'Historical rates are unavailable right now.' }}</p>
        <Button label="Try again" variant="subtle" @click="emit('retry')" />
      </div>

      <div
        v-else-if="state === 'empty' || state === 'unsupported'"
        class="flex h-56 items-center justify-center rounded-xl bg-surface-gray-2 px-6 text-center"
      >
        <p class="text-sm text-ink-gray-6">
          {{ state === 'unsupported'
            ? 'Choose two different currencies to see their rate history.'
            : 'The ECB does not publish enough history for this pair and range.' }}
        </p>
      </div>

      <figure v-else-if="state === 'ready'" class="m-0">
        <svg
          ref="svg"
          :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
          class="w-full touch-none"
          role="img"
          :aria-label="`${base} to ${quote} exchange rate over ${range}`"
          @pointermove="onPointerMove"
          @pointerleave="hoverIndex = null"
        >
          <line
            v-for="tick in yTicks"
            :key="tick.value"
            :x1="PAD.left"
            :x2="VIEW_W - PAD.right"
            :y1="tick.y"
            :y2="tick.y"
            class="stroke-outline-gray-2"
            stroke-width="1"
          />
          <text
            v-for="tick in yTicks"
            :key="`label-${tick.value}`"
            :x="PAD.left"
            :y="tick.y - 3"
            class="fill-ink-gray-4 text-[10px]"
          >
            {{ formatRate(tick.value) }}
          </text>

          <polygon :points="areaPoints" class="fill-ink-gray-9 opacity-[0.06]" />
          <polyline
            :points="linePoints"
            fill="none"
            class="stroke-ink-gray-8"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />

          <g v-if="hovered">
            <line
              :x1="hovered.x"
              :x2="hovered.x"
              :y1="PAD.top"
              :y2="VIEW_H - PAD.bottom"
              class="stroke-outline-gray-3"
              stroke-width="1"
            />
            <circle :cx="hovered.x" :cy="hovered.y" r="3.5" class="fill-ink-gray-9" />
            <g :transform="`translate(${tooltipX}, ${PAD.top})`">
              <rect width="132" height="38" rx="6" class="fill-surface-base stroke-outline-gray-2" />
              <text x="8" y="15" class="fill-ink-gray-5 text-[10px]">{{ formatDate(hovered.date) }}</text>
              <text x="8" y="30" class="fill-ink-gray-9 text-[12px] font-semibold">
                {{ formatRate(hovered.value) }} {{ quote }}
              </text>
            </g>
          </g>

          <text
            :x="PAD.left"
            :y="VIEW_H - 6"
            class="fill-ink-gray-4 text-[10px]"
          >
            {{ formatDate(series.points[0].date) }}
          </text>
          <text
            :x="VIEW_W - PAD.right"
            :y="VIEW_H - 6"
            text-anchor="end"
            class="fill-ink-gray-4 text-[10px]"
          >
            {{ formatDate(series.points.at(-1).date) }}
          </text>
        </svg>
      </figure>
    </div>

    <p v-if="series?.source" class="pt-4 text-sm leading-6 text-ink-gray-5">
      ECB reference rates are for information only and are not transaction rates.
      <a
        class="font-medium text-ink-gray-8 underline underline-offset-4"
        :href="series.source.url"
        target="_blank"
        rel="noreferrer"
      >Source: ECB statistics</a>
    </p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, LoadingText, TabButtons } from 'frappe-ui'

import { buildRateCsv } from './rateHistory'

const VIEW_W = 640
const VIEW_H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 16 }
const PLOT_W = VIEW_W - PAD.left - PAD.right
const PLOT_H = VIEW_H - PAD.top - PAD.bottom
const TOOLTIP_W = 132

const props = defineProps({
  series: { type: Object, default: null },
  range: { type: String, default: '1Y' },
  ranges: { type: Array, required: true },
  state: { type: String, default: 'idle' },
  errorMessage: { type: String, default: '' },
  base: { type: String, default: '' },
  quote: { type: String, default: '' },
})

const emit = defineEmits(['set-range', 'retry'])

const svg = ref(null)
const hoverIndex = ref(null)

const numberFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

const rangeTabs = computed(() =>
  props.ranges.map((option) => ({ label: option.label, value: option.key })),
)

const points = computed(() => props.series?.points ?? [])

const bounds = computed(() => {
  const values = points.value.map((point) => point.value)
  if (!values.length) return { min: 0, max: 1 }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) * 0.01 || 1
  // Rates hover around a value, so pad the extremes instead of anchoring at zero.
  return { min: min - span * 0.08, max: max + span * 0.08 }
})

const scaled = computed(() => {
  const { min, max } = bounds.value
  const range = max - min || 1
  const count = points.value.length
  return points.value.map((point, index) => ({
    ...point,
    x: PAD.left + (count > 1 ? (index / (count - 1)) * PLOT_W : PLOT_W / 2),
    y: PAD.top + (1 - (point.value - min) / range) * PLOT_H,
  }))
})

const linePoints = computed(() =>
  scaled.value.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
)

const areaPoints = computed(() => {
  if (!scaled.value.length) return ''
  const base = VIEW_H - PAD.bottom
  return `${PAD.left},${base} ${linePoints.value} ${VIEW_W - PAD.right},${base}`
})

const yTicks = computed(() => {
  const { min, max } = bounds.value
  const range = max - min || 1
  return [0, 0.5, 1].map((fraction) => {
    const value = min + fraction * range
    return { value, y: PAD.top + (1 - fraction) * PLOT_H }
  })
})

const latest = computed(() => points.value.at(-1) ?? { value: 0 })

const change = computed(() => {
  const first = points.value[0]?.value ?? 0
  const last = latest.value.value
  const absolute = last - first
  const percent = first ? `${((absolute / first) * 100).toFixed(2)}%` : '—'
  return { absolute, percent, direction: absolute < 0 ? 'down' : 'up' }
})

const hovered = computed(() => (hoverIndex.value === null ? null : scaled.value[hoverIndex.value]))

const tooltipX = computed(() => {
  if (!hovered.value) return 0
  return Math.min(Math.max(hovered.value.x - TOOLTIP_W / 2, PAD.left), VIEW_W - PAD.right - TOOLTIP_W)
})

function onPointerMove(event) {
  const element = svg.value
  const count = points.value.length
  if (!element || count < 2) return
  const rect = element.getBoundingClientRect()
  if (!rect.width) return
  const viewX = ((event.clientX - rect.left) / rect.width) * VIEW_W
  const fraction = Math.min(Math.max((viewX - PAD.left) / PLOT_W, 0), 1)
  hoverIndex.value = Math.round(fraction * (count - 1))
}

function formatRate(value) {
  return Number.isFinite(value) ? numberFormat.format(value) : '—'
}

function formatDate(iso) {
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? iso : dateFormat.format(parsed)
}

function downloadCsv() {
  if (!props.series) return
  const csv = buildRateCsv(props.series)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${props.base}-${props.quote}-${props.range}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>
