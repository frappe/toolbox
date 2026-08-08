<template>
  <FormControl v-bind="controlProps" @update:model-value="$emit('update:modelValue', $event)">
    <template v-if="input.type === 'number' && input.suffix" #suffix>
      <span class="text-sm text-ink-gray-5">{{ input.suffix }}</span>
    </template>
  </FormControl>
</template>
<script setup>
import { computed } from 'vue'
import { FormControl } from 'frappe-ui'
const props = defineProps({ input: { type: Object, required: true }, inputId: { type: String, required: true }, modelValue: { type: String, default: '' }, describedBy: { type: String, required: true } })
defineEmits(['update:modelValue'])
// Only bind what each control understands — a stray `options` on a text input
// would land on the <input> element as an attribute.
const controlProps = computed(() => {
  const shared = { id: props.inputId, type: props.input.type, size: 'md', variant: 'outline', label: props.input.label, modelValue: props.modelValue, 'aria-describedby': props.describedBy }
  if (props.input.type === 'select') return { ...shared, options: props.input.options }
  if (props.input.type === 'number') return { ...shared, step: 'any' }
  return { ...shared, placeholder: props.input.placeholder }
})
</script>
