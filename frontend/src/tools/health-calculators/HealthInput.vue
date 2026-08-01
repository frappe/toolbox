<template>
  <label class="grid gap-2 text-sm font-medium text-ink-gray-7">
    <span>{{ input.label }}</span>
    <div v-if="input.type === 'number'" class="flex h-11 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-white focus-within:ring-2 focus-within:ring-outline-gray-3">
      <input :id="inputId" :value="modelValue" class="min-w-0 flex-1 bg-transparent px-3 text-base outline-none" type="number" step="any" :aria-describedby="describedBy" @input="$emit('update:modelValue', $event.target.value)" />
      <span class="flex items-center border-l border-outline-gray-2 px-3 text-sm font-normal text-ink-gray-5">{{ input.suffix }}</span>
    </div>
    <select v-else-if="input.type === 'select'" :id="inputId" :value="modelValue" class="h-11 rounded-lg border border-outline-gray-2 bg-surface-white px-3 text-base" :aria-describedby="describedBy" @change="$emit('update:modelValue', $event.target.value)"><option v-for="option in input.options" :key="option.value" :value="option.value">{{ option.label }}</option></select>
    <input v-else :id="inputId" :value="modelValue" class="h-11 rounded-lg border border-outline-gray-2 bg-surface-white px-3 text-base" :placeholder="input.placeholder" :aria-describedby="describedBy" @input="$emit('update:modelValue', $event.target.value)" />
  </label>
</template>
<script setup>
defineProps({ input: { type: Object, required: true }, inputId: { type: String, required: true }, modelValue: { type: String, default: '' }, describedBy: { type: String, required: true } })
defineEmits(['update:modelValue'])
</script>
