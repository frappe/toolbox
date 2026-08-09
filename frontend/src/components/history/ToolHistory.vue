<template>
  <section :aria-labelledby="titleId" class="flex min-h-0 flex-col">
    <header class="flex items-center gap-3 border-b border-outline-gray-2 pb-4">
      <div class="min-w-0 flex-1">
        <h2 :id="titleId" class="text-lg font-semibold text-ink-gray-9">
          {{ title }}
        </h2>
        <p class="pt-1 text-sm text-ink-gray-5">{{ note }}</p>
      </div>
      <!--
        The visible text and the spoken name differ, so the text goes in the default slot.
        A `label` prop would win over `aria-label` and every tool would announce "Clear all" (#144).
      -->
      <Button v-if="entries.length" class="h-11" variant="ghost" :aria-label="clearLabel" @click="emit('clear')">
        Clear all
      </Button>
    </header>

    <div
      v-if="!entries.length"
      class="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center"
    >
      <span class="flex size-10 items-center justify-center rounded-xl bg-surface-gray-2">
        <Icon name="lucide-history" class="size-5 text-ink-gray-6" />
      </span>
      <div>
        <p class="text-sm font-medium text-ink-gray-8">{{ emptyTitle }}</p>
        <p class="pt-1 text-sm leading-6 text-ink-gray-5">{{ emptyDescription }}</p>
      </div>
    </div>

    <ol v-else class="divide-y divide-outline-gray-2" :aria-label="listLabel">
      <li v-for="entry in entries" :key="entry.id" class="flex items-center gap-2 py-2.5">
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <p
              class="min-w-0 flex-1 truncate text-xs text-ink-gray-5"
              :class="mono ? 'font-mono' : ''"
              :title="entry.label"
            >
              {{ entry.label }}
            </p>
            <time
              v-if="entry.timestamp"
              class="shrink-0 text-xs tabular-nums text-ink-gray-4"
              :datetime="new Date(entry.timestamp).toISOString()"
              :title="formatHistoryTimestampTitle(entry.timestamp)"
            >
              {{ formatHistoryTimestamp(entry.timestamp) }}
            </time>
          </div>
          <p
            class="block truncate text-base font-semibold tabular-nums text-ink-gray-9"
            :class="mono ? 'font-mono' : ''"
          >
            {{ entry.value }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-0.5" role="group" :aria-label="actionsLabel">
          <Button
            v-if="showReuse"
            class="size-8"
            variant="ghost"
            :icon="reuseIcon"
            :title="reuseTitle"
            :aria-label="`${reuseVerb} ${entry.label}`"
            @click="emit('reuse', entry)"
          />
          <Button
            class="size-8"
            variant="ghost"
            :icon="copiedEntryId === entry.id ? 'lucide-check' : 'lucide-copy'"
            :title="copiedEntryId === entry.id ? 'Copied' : 'Copy result'"
            :aria-label="
              copiedEntryId === entry.id
                ? `Copied result ${entry.value}`
                : `Copy result ${entry.value}`
            "
            @click="emit('copy', entry)"
          />
          <Button
            class="size-8"
            variant="ghost"
            icon="lucide-trash-2"
            title="Delete from history"
            :aria-label="`Delete ${entry.label} from history`"
            @click="emit('remove', entry.id)"
          />
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { useId } from 'vue'
import { Button, Icon } from 'frappe-ui'

import {
  formatHistoryTimestamp,
  formatHistoryTimestampTitle,
} from './formatHistoryTimestamp'

defineProps({
  // Each entry: { id, label, value, timestamp?, payload? }.
  // `label` is the input summary/expression; `value` is the result.
  entries: { type: Array, required: true },
  copiedEntryId: { type: String, default: '' },
  title: { type: String, default: 'History' },
  note: { type: String, default: 'Saved only in this browser.' },
  listLabel: { type: String, default: 'History entries' },
  actionsLabel: { type: String, default: 'History entry actions' },
  clearLabel: { type: String, default: 'Clear history' },
  emptyTitle: { type: String, default: 'No history yet' },
  emptyDescription: {
    type: String,
    default: 'Completed results will appear here for reuse.',
  },
  showReuse: { type: Boolean, default: true },
  reuseIcon: { type: String, default: 'lucide-rotate-ccw' },
  reuseVerb: { type: String, default: 'Reuse' },
  reuseTitle: { type: String, default: 'Reuse' },
  mono: { type: Boolean, default: false },
})

const emit = defineEmits(['reuse', 'copy', 'remove', 'clear'])

const titleId = `tool-history-title-${useId()}`
</script>
