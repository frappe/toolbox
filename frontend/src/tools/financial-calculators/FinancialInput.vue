<template>
  <FormControl
    v-bind="controlProps"
    @update:model-value="onUpdate"
    @change="onNumberCommit"
  >
    <template v-if="input.type === 'number'" #suffix>
      <span class="text-sm text-ink-gray-5" aria-hidden="true">{{ suffixLabel }}</span>
    </template>
  </FormControl>
</template>

<script setup>
import { computed } from 'vue'
import { FormControl } from 'frappe-ui'

const props = defineProps({
  input: { type: Object, required: true },
  inputId: { type: String, required: true },
  modelValue: { type: String, required: true },
  currency: { type: String, required: true },
  describedBy: { type: String, required: true },
})

const emit = defineEmits(['update:modelValue', 'commit'])

const suffixLabel = computed(() =>
  props.input.suffix === 'currency' ? props.currency : props.input.suffix,
)

// Only bind what each control understands — a stray `options` on a number input
// would land on the <input> element as an attribute.
const controlProps = computed(() => {
  const shared = {
    id: props.inputId,
    type: props.input.type,
    size: 'md',
    variant: 'outline',
    label: props.input.label,
    modelValue: props.modelValue,
    'aria-describedby': props.describedBy,
  }

  return props.input.type === 'number'
    ? { ...shared, inputmode: 'decimal', step: 'any', class: '[&_input]:tabular-nums' }
    : { ...shared, options: props.input.options }
})

function onUpdate(value) {
  emit('update:modelValue', value)
  // A select commits immediately; a number field commits on its own change event.
  if (props.input.type !== 'number') emit('commit')
}

// Select dispatches no native change event through FormControl, so this only
// fires for the number branch.
function onNumberCommit() {
  if (props.input.type === 'number') emit('commit')
}
</script>
