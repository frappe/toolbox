<template>
  <section aria-labelledby="calculator-history-title" class="flex min-h-0 flex-col">
    <header class="flex items-center gap-3 border-b border-outline-gray-2 pb-4">
      <div class="min-w-0 flex-1">
        <h2 id="calculator-history-title" class="text-lg font-semibold text-ink-gray-9">
          History
        </h2>
        <p class="pt-1 text-sm text-ink-gray-5">Saved only in this browser.</p>
      </div>
      <Button
        v-if="entries.length"
        class="h-11"
        label="Clear all"
        variant="ghost"
        aria-label="Clear calculator history"
        @click="emit('clear')"
      />
    </header>

    <div v-if="!entries.length" class="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <span class="flex size-10 items-center justify-center rounded-xl bg-surface-gray-2">
        <Icon name="lucide-history" class="size-5 text-ink-gray-6" />
      </span>
      <div>
        <p class="text-sm font-medium text-ink-gray-8">No calculations yet</p>
        <p class="pt-1 text-sm leading-6 text-ink-gray-5">
          Completed expressions will appear here for reuse.
        </p>
      </div>
    </div>

    <ol v-else class="divide-y divide-outline-gray-2" aria-label="Calculator history entries">
      <li v-for="entry in entries" :key="entry.id" class="flex flex-col gap-3 py-4">
        <div class="min-w-0">
          <p class="truncate font-mono text-sm text-ink-gray-6" :title="entry.expression">
            {{ entry.expression }}
          </p>
          <output class="block truncate pt-1 font-mono text-lg font-semibold text-ink-gray-9">
            {{ entry.result }}
          </output>
        </div>
        <div class="flex shrink-0 items-center gap-1 self-end" role="group" aria-label="History entry actions">
          <Button
            class="size-11"
            variant="ghost"
            icon="lucide-rotate-ccw"
            :aria-label="`Reuse ${entry.expression}`"
            @click="emit('reuse', entry)"
          />
          <Button
            class="size-11"
            variant="ghost"
            :icon="copiedEntryId === entry.id ? 'lucide-check' : 'lucide-copy'"
            :aria-label="copiedEntryId === entry.id ? `Copied result ${entry.result}` : `Copy result ${entry.result}`"
            @click="emit('copy', entry)"
          />
          <Button
            class="size-11"
            variant="ghost"
            icon="lucide-trash-2"
            :aria-label="`Delete ${entry.expression} from history`"
            @click="emit('remove', entry.id)"
          />
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { Button, Icon } from 'frappe-ui'

defineProps({
  entries: { type: Array, required: true },
  copiedEntryId: { type: String, default: '' },
})

const emit = defineEmits(['reuse', 'copy', 'remove', 'clear'])
</script>
