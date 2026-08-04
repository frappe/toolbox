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
    <span class="rounded-full bg-surface-base px-3 py-1 text-xs font-medium capitalize text-ink-gray-7">
      {{ status }}
    </span>
  </aside>
</template>
<script setup>
import { formatDuration } from './formatTime'

defineProps({
  label: { type: String, required: true },
  milliseconds: { type: Number, required: true },
  status: { type: String, required: true },
  precise: Boolean,
})
</script>
