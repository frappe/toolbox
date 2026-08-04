<template>
  <div>
    <p class="pb-1.5 text-xs font-medium uppercase tracking-wide text-ink-gray-5">{{ label }}</p>
    <div class="grid grid-cols-2 rounded-lg bg-surface-gray-2 p-1">
      <button
        v-for="option in options"
        :key="option"
        type="button"
        class="rounded-md px-2 py-1.5 text-xs font-medium capitalize text-ink-gray-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
        :class="value === option ? 'bg-surface-base text-ink-gray-9 shadow-sm' : ''"
        :aria-pressed="value === option"
        @click="$emit('change', option)"
      >
        {{ option }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  options: { type: Array, required: true },
  value: { type: String, required: true },
})

defineEmits(['change'])
</script>
