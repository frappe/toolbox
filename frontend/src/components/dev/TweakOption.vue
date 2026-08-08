<template>
  <div>
    <p class="pb-1.5 text-xs font-medium uppercase tracking-wide text-ink-gray-5">{{ label }}</p>
    <TabButtons
      class="w-full [&_button]:capitalize"
      :model-value="value"
      :options="tabs"
      size="sm"
      :aria-label="label"
      @update:model-value="$emit('change', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TabButtons } from 'frappe-ui'

const props = defineProps({
  label: { type: String, required: true },
  options: { type: Array, required: true },
  value: { type: String, required: true },
})

defineEmits(['change'])

const tabs = computed(() => props.options.map((option) => ({ label: option, value: option })))
</script>
