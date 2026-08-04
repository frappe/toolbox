<template>
  <figure class="mt-6 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-gray-1">
    <div class="flex items-center justify-between px-4 py-2">
      <figcaption class="text-sm text-ink-gray-6">{{ caption }}</figcaption>
      <div class="flex gap-1" role="group" aria-label="Map zoom">
        <button type="button" class="flex size-8 items-center justify-center rounded-lg bg-surface-base text-ink-gray-7 shadow-sm hover:bg-surface-gray-2" aria-label="Zoom in" @click="zoomBy(1.5)"><Icon name="lucide-plus" class="size-4" /></button>
        <button type="button" class="flex size-8 items-center justify-center rounded-lg bg-surface-base text-ink-gray-7 shadow-sm hover:bg-surface-gray-2" aria-label="Zoom out" @click="zoomBy(1 / 1.5)"><Icon name="lucide-minus" class="size-4" /></button>
        <button type="button" class="flex size-8 items-center justify-center rounded-lg bg-surface-base text-ink-gray-7 shadow-sm hover:bg-surface-gray-2" aria-label="Reset view" @click="resetView"><Icon name="lucide-locate-fixed" class="size-4" /></button>
      </div>
    </div>
    <svg
      ref="svg"
      class="pin-map block w-full touch-none select-none"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      role="img"
      :aria-label="ariaLabel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endPan"
      @pointerleave="endPan"
    >
      <g :transform="`translate(${pan.x} ${pan.y}) scale(${zoom})`">
        <path v-for="(d, index) in statePaths" :key="index" :d="d" class="pin-map__state" />
        <circle
          v-for="place in markers"
          :key="place.key"
          :cx="place.x"
          :cy="place.y"
          :r="6 / zoom"
          :stroke-width="2 / zoom"
          class="pin-map__marker"
        >
          <title>{{ place.label }}</title>
        </circle>
      </g>
    </svg>
    <p class="px-4 py-2 text-xs text-ink-gray-5">
      Boundaries: geoBoundaries (CC BY 2.5 IN). Positions are approximate office coordinates from India Post.
    </p>
  </figure>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from 'frappe-ui'

import indiaStates from './indiaStates.json'

const props = defineProps({
  results: { type: Array, required: true },
})

// India bounding box -> a fixed SVG canvas, longitude squeezed by cos(mean latitude) so the
// country is not stretched sideways. Plain equirectangular is fine at national scale.
const LON_MIN = 68
const LON_MAX = 98
const LAT_MIN = 6
const LAT_MAX = 38
const LON_SCALE = Math.cos(((LAT_MIN + LAT_MAX) / 2) * (Math.PI / 180))
const WIDTH = 1000
const HEIGHT = Math.round((WIDTH * (LAT_MAX - LAT_MIN)) / ((LON_MAX - LON_MIN) * LON_SCALE))

function project(lon, lat) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * WIDTH
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * HEIGHT
  return [x, y]
}

const statePaths = indiaStates.features.flatMap((feature) =>
  feature.geometry.coordinates.map((polygon) => {
    const ring = polygon[0]
    return ring
      .map(([lon, lat], index) => {
        const [x, y] = project(lon, lat)
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ') + ' Z'
  }),
)

const located = computed(() =>
  props.results
    .map((result) => ({ result, lat: Number(result.latitude), lon: Number(result.longitude) }))
    .filter((item) => item.result.latitude && item.result.longitude && !Number.isNaN(item.lat) && !Number.isNaN(item.lon)),
)

const markers = computed(() =>
  located.value.map(({ result, lat, lon }, index) => {
    const [x, y] = project(lon, lat)
    return { key: `${result.pin_code}:${index}`, x, y, label: `${result.office_name} (${result.pin_code})` }
  }),
)

const missingCount = computed(() => props.results.length - located.value.length)
const caption = computed(() => {
  const shown = markers.value.length
  const missing = missingCount.value
  const base = `${shown} ${shown === 1 ? 'office' : 'offices'} on the map`
  return missing ? `${base} · ${missing} without coordinates` : base
})
const ariaLabel = computed(() => `Map of India showing ${markers.value.length} post office locations.`)

const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const drag = ref(null)

function zoomBy(factor) {
  const next = Math.min(8, Math.max(1, zoom.value * factor))
  // Keep the canvas centre fixed while scaling.
  const cx = WIDTH / 2
  const cy = HEIGHT / 2
  pan.value = {
    x: cx - ((cx - pan.value.x) / zoom.value) * next,
    y: cy - ((cy - pan.value.y) / zoom.value) * next,
  }
  zoom.value = next
}

function resetView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}

function onPointerDown(event) {
  drag.value = { x: event.clientX, y: event.clientY, panX: pan.value.x, panY: pan.value.y }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event) {
  if (!drag.value) return
  const svg = event.currentTarget
  const scale = WIDTH / svg.clientWidth
  pan.value = {
    x: drag.value.panX + (event.clientX - drag.value.x) * scale,
    y: drag.value.panY + (event.clientY - drag.value.y) * scale,
  }
}

function endPan() {
  drag.value = null
}
</script>

<style scoped>
.pin-map {
  aspect-ratio: v-bind('`${WIDTH} / ${HEIGHT}`');
  background: var(--surface-gray-1);
  cursor: grab;
}
.pin-map:active {
  cursor: grabbing;
}
.pin-map__state {
  fill: var(--surface-gray-3);
  stroke: var(--outline-gray-2);
  stroke-width: 1;
  stroke-linejoin: round;
}
.pin-map__marker {
  fill: var(--surface-red-5);
  stroke: var(--surface-base);
}
</style>
