<template>
  <section class="pt-5">
    <h2 class="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
      {{ label }}
    </h2>
    <div class="space-y-0.5">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
})
</script>
