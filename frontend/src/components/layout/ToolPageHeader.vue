<template>
  <header :class="icon ? 'flex items-start gap-4' : ''">
    <span
      v-if="icon"
      class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2"
    >
      <Icon :name="icon" class="size-6 text-ink-gray-7" />
    </span>

    <div class="min-w-0 flex-1">
      <p v-if="category" class="text-sm font-medium text-ink-gray-5">{{ category }}</p>
      <!--
        The one `<h1>` of the page. `seo.spec.js` asserts exactly one per route, and the words are
        the product, so this stays a real heading. frappe-ui's `PageHeader` was read against this
        and rejected in #259: it is an app-chrome strip that renders into a `PageHeaderTarget`, and
        its title is a `<span>`.
      -->
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <h1 class="text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          {{ title }}
        </h1>
        <slot name="title-suffix" />
      </div>
      <p v-if="description" class="pt-2 text-base leading-7 text-ink-gray-6">{{ description }}</p>
    </div>
  </header>
</template>

<script setup>
import { Icon } from 'frappe-ui'

// The same eight lines were written out in 15 views, and three had already drifted: All Tools
// dropped the responsive step and rendered its heading at 30px on a phone where every tool page
// rendered 24px (#279).
defineProps({
  // A page with no icon draws no tile. The prose pages and All Tools are not tools.
  icon: { type: String, default: '' },
  category: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>
