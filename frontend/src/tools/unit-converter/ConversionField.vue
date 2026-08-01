<template>
  <section class="min-w-0 rounded-xl bg-surface-base p-4 sm:p-5" :aria-labelledby="headingId">
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <h2 :id="headingId" class="text-sm font-medium text-ink-gray-6">{{ label }}</h2>
        <label :for="inputId" class="sr-only">{{ label }} value</label>
        <input
          :id="inputId"
          :value="modelValue"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          class="mt-3 h-14 w-full min-w-0 bg-transparent text-3xl font-medium tracking-tight text-ink-gray-9 outline-none placeholder:text-ink-gray-3 sm:text-4xl"
          placeholder="0"
          :aria-invalid="invalid || undefined"
          @input="$emit('update:modelValue', $event.target.value)"
        />
      </div>
    </div>
    <UnitPicker
      class="pt-4"
      :model-value="unitId"
      :category-id="categoryId"
      :label="`${label} unit`"
      @update:model-value="$emit('update:unitId', $event)"
    />
  </section>
</template>

<script setup>
import { useId } from 'vue'

import UnitPicker from './UnitPicker.vue'

defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, required: true },
  unitId: { type: String, required: true },
  categoryId: { type: String, required: true },
  invalid: { type: Boolean, default: false },
})
defineEmits(['update:modelValue', 'update:unitId'])

const componentId = useId()
const headingId = `conversion-heading-${componentId}`
const inputId = `conversion-value-${componentId}`
</script>
