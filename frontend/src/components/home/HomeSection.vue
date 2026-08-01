<template>
  <section>
    <div class="flex h-8 items-center justify-between px-2">
      <h2 class="text-base font-semibold text-ink-gray-9">{{ title }}</h2>
      <RouterLink v-if="linkTo" :to="linkTo" class="text-sm font-medium text-ink-gray-5 hover:text-ink-gray-8">
        {{ linkLabel }}
      </RouterLink>
    </div>
    <div class="pt-1">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  linkLabel: { type: String, default: '' },
  linkTo: { type: String, default: '' },
})
</script>
