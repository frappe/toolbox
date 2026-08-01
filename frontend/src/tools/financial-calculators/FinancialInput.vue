<template>
  <div>
    <label :for="inputId" class="block text-sm font-medium text-ink-gray-7">
      {{ input.label }}
    </label>
    <div v-if="input.type === 'number'" class="relative mt-2">
      <input
        :id="inputId"
        :value="modelValue"
        type="number"
        inputmode="decimal"
        step="any"
        autocomplete="off"
        class="h-11 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 pr-24 text-base tabular-nums text-ink-gray-9 outline-none focus:ring-2 focus:ring-outline-gray-3"
        :aria-describedby="describedBy"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <span
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-gray-5"
        aria-hidden="true"
      >
        {{ input.suffix === 'currency' ? currency : input.suffix }}
      </span>
    </div>
    <select
      v-else
      :id="inputId"
      :value="modelValue"
      class="mt-2 h-11 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-8 outline-none focus:ring-2 focus:ring-outline-gray-3"
      :aria-describedby="describedBy"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option v-for="option in input.options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script setup>
defineProps({
  input: { type: Object, required: true },
  inputId: { type: String, required: true },
  modelValue: { type: String, required: true },
  currency: { type: String, required: true },
  describedBy: { type: String, required: true },
})

defineEmits(['update:modelValue'])
</script>
