<template>
  <section class="pt-5">
    <h2
      v-if="!collapsed"
      class="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-ink-gray-5"
    >
      {{ label }}
    </h2>
    <div v-else class="mx-2 mb-2 border-t border-outline-gray-2" aria-hidden="true" />
    <div class="space-y-0.5">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  collapsed: { type: Boolean, default: false },
})
</script>
