<template>
  <section class="min-w-0 rounded-xl bg-surface-base p-4 sm:p-5" :aria-labelledby="headingId">
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <h2 :id="headingId" class="text-sm font-medium text-ink-gray-6">{{ label }}</h2>
        <label :for="inputId" class="sr-only">{{ label }} value</label>
        <!--
          The value is the hero of this tool, so it keeps its oversized display
          type: TextInput tops out at `text-2xl`, and the `[&_input]:` overrides
          below only restyle the type scale. Everything else — focus, disabled,
          dark color-scheme, labeling — comes from the component.
        -->
        <TextInput
          :id="inputId"
          :model-value="modelValue"
          type="text"
          size="xl"
          variant="ghost"
          inputmode="decimal"
          spellcheck="false"
          class="mt-3 w-full min-w-0 [&_input]:h-14 [&_input]:bg-transparent [&_input]:px-0 [&_input]:text-3xl [&_input]:font-medium [&_input]:tracking-tight [&_input]:text-ink-gray-9 [&_input]:placeholder-ink-gray-3 sm:[&_input]:text-4xl"
          placeholder="0"
          :aria-invalid="invalid || undefined"
          @update:model-value="$emit('update:modelValue', $event)"
          @change="$emit('commit')"
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
import { TextInput } from 'frappe-ui'

import UnitPicker from './UnitPicker.vue'

defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, required: true },
  unitId: { type: String, required: true },
  categoryId: { type: String, required: true },
  invalid: { type: Boolean, default: false },
})
defineEmits(['update:modelValue', 'update:unitId', 'commit'])

const componentId = useId()
const headingId = `conversion-heading-${componentId}`
const inputId = `conversion-value-${componentId}`
</script>
