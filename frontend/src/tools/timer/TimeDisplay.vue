<template>
  <aside
    class="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-outline-gray-2 bg-surface-gray-2 p-6 text-center"
    aria-live="polite"
  >
    <p class="text-sm font-medium text-ink-gray-6">{{ label }}</p>
    <p
      class="font-mono text-5xl font-semibold tabular-nums tracking-tight text-ink-gray-9"
      role="timer"
    >
      {{ formatDuration(milliseconds, precise) }}
    </p>
    <Badge :theme="statusTheme" variant="subtle" size="md" :label="statusLabel" />
  </aside>
</template>
<script setup>
import { computed } from 'vue'
import { Badge } from 'frappe-ui'

import { formatDuration } from './formatTime'

const props = defineProps({
  label: { type: String, required: true },
  milliseconds: { type: Number, required: true },
  status: { type: String, required: true },
  precise: Boolean,
})

const statusLabel = computed(() => props.status.charAt(0).toUpperCase() + props.status.slice(1))
// Colour the pill by state; anything unmapped (e.g. idle) reads neutral gray.
// Keep every value inside Badge's theme union: an unknown theme is not ignored, it
// throws while computing the classes and takes the whole subtree down. 'amber' is the
// real name — 'orange' is a silent deprecated alias for it.
const statusTheme = computed(() => ({ running: 'green', paused: 'amber', finished: 'blue' })[props.status] || 'gray')
</script>
