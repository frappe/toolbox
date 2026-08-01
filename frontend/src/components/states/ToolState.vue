<template>
  <section
    class="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center"
    :aria-labelledby="titleId"
    :aria-live="status === 'loading' ? 'polite' : undefined"
    :role="status === 'error' ? 'alert' : 'status'"
  >
    <LoadingIndicator v-if="status === 'loading'" class="size-6 text-ink-gray-5" />
    <span
      v-else
      class="flex size-10 items-center justify-center rounded-xl bg-surface-gray-2 text-ink-gray-6"
    >
      <Icon :name="state.icon" class="size-5" />
    </span>

    <h2 :id="titleId" class="pt-4 text-base font-medium text-ink-gray-9">
      {{ title }}
    </h2>
    <p class="max-w-md pt-2 text-sm leading-6 text-ink-gray-5">
      {{ message }}
    </p>

    <dl v-if="details.length" class="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-3 text-xs text-ink-gray-5">
      <div v-for="detail in details" :key="detail.label" class="flex gap-1">
        <dt class="font-medium text-ink-gray-6">{{ detail.label }}:</dt>
        <dd>{{ detail.value }}</dd>
      </div>
    </dl>

    <div v-if="actionLabel || secondaryActionLabel" class="flex flex-wrap justify-center gap-2 pt-5">
      <Button
        v-if="actionLabel"
        :label="actionLabel"
        variant="solid"
        @click="$emit('action')"
      />
      <Button
        v-if="secondaryActionLabel"
        :label="secondaryActionLabel"
        variant="subtle"
        @click="$emit('secondary-action')"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, useId } from 'vue'
import { Button, Icon, LoadingIndicator } from 'frappe-ui'

const stateByStatus = Object.freeze({
  empty: { icon: 'lucide-inbox' },
  error: { icon: 'lucide-triangle-alert' },
  disabled: { icon: 'lucide-shield-alert' },
  stale: { icon: 'lucide-clock-alert' },
  offline: { icon: 'lucide-wifi-off' },
  loading: { icon: 'lucide-loader-circle' },
})

const props = defineProps({
  status: {
    type: String,
    default: 'empty',
    validator: (value) => ['empty', 'error', 'disabled', 'stale', 'offline', 'loading'].includes(value),
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  actionLabel: { type: String, default: '' },
  secondaryActionLabel: { type: String, default: '' },
  source: { type: String, default: '' },
  updatedAt: { type: String, default: '' },
  cacheAge: { type: String, default: '' },
  detailLabel: { type: String, default: '' },
  detailValue: { type: String, default: '' },
})

defineEmits(['action', 'secondary-action'])

const titleId = `tool-state-${useId()}`
const state = computed(() => stateByStatus[props.status])
const details = computed(() =>
  [
    { label: 'Source', value: props.source },
    { label: 'Updated', value: props.updatedAt },
    { label: 'Cache age', value: props.cacheAge },
    { label: props.detailLabel, value: props.detailValue },
  ].filter((detail) => detail.label && detail.value),
)
</script>
