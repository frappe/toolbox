<template>
  <div class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
    <div class="min-w-0 flex-1 pr-4">
      <h2 class="text-sm font-medium text-ink-gray-9">{{ label }}</h2>
      <p class="pt-1 text-sm leading-5 text-ink-gray-5">{{ description }}</p>
    </div>
    <div class="w-full shrink-0 sm:w-56">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  description: { type: String, required: true },
})
</script>
