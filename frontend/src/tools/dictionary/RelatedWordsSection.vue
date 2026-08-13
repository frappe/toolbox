<template>
  <section :aria-labelledby="headingId">
    <h3 :id="headingId" class="text-sm font-semibold uppercase tracking-wide text-ink-gray-5">{{ heading }}</h3>
    <div v-if="groups.length" class="space-y-3 pt-3">
      <div v-for="group in groups" :key="group.pos">
        <!-- One list needs no label saying which part of speech it is; several do. -->
        <p v-if="groups.length > 1" class="text-xs text-ink-gray-5">{{ partOfSpeechLabel(group.pos) }}</p>
        <div class="flex flex-wrap gap-2 pt-1.5">
          <Button
            v-for="word in group.words"
            :key="word"
            variant="subtle"
            size="sm"
            :label="word"
            @click="emit('select', word)"
          />
        </div>
      </div>
    </div>
    <p v-else class="pt-2 text-sm leading-6 text-ink-gray-6">{{ emptyMessage }}</p>
  </section>
</template>

<script setup>
import { Button } from 'frappe-ui'
import { partOfSpeechLabel } from './partsOfSpeech'

defineProps({
  heading: { type: String, required: true },
  headingId: { type: String, required: true },
  groups: { type: Array, required: true },
  emptyMessage: { type: String, required: true },
})

const emit = defineEmits(['select'])
</script>
