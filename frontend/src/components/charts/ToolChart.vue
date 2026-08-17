<template>
  <figure :class="figureClass">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="w-full"
      :class="svgClass"
      :preserve-aspect-ratio="stretch ? 'none' : undefined"
      role="img"
      :aria-label="ariaLabel"
      v-bind="$attrs"
    >
      <slot />
    </svg>
    <figcaption v-if="$slots.caption" :class="captionClass">
      <slot name="caption" />
    </figcaption>
  </figure>
</template>

<script setup>
// The figure, the viewBox and the accessible name, which is all three charts had in common.
//
// A chart is a picture of numbers, so it is `role="img"` with a name that says what it shows —
// a screen reader gets the sentence rather than a list of coordinates. That was written out three
// times and is written once here (#280); the numbers themselves each chart still draws, because
// they are three different pictures. `seriesPath.js` carries the part two of them share.
//
// frappe-ui ships `AxisChart` on echarts, and it was measured rather than assumed: ~300 kB gzipped
// against a 569 kB budget CI enforces, on a site scoring 99 for Lighthouse performance where 26 of
// 33 tools work offline. Three small charts do not justify it. Vibhav's call, recorded in #280.
defineOptions({ inheritAttrs: false })

defineProps({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  ariaLabel: { type: String, required: true },
  // A sparkline is read for its shape rather than its proportions, so it may fill its box.
  stretch: { type: Boolean, default: false },
  figureClass: { type: String, default: '' },
  svgClass: { type: String, default: '' },
  captionClass: { type: String, default: '' },
})
</script>
