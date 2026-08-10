<template>
  <nav :aria-label="label" class="-mx-1 px-1">
    <!-- The pills wrap rather than scroll. Nine converters named "<measurement> Converter" are
         far wider than the column they sit in, and a strip that scrolls sideways with no
         affordance hides the last four from anyone who does not think to drag it. -->
    <ul class="inline-flex flex-wrap items-center gap-1.5 rounded-[10px] bg-surface-gray-2 p-px">
      <li v-for="link in links" :key="link.route">
        <RouterLink
          :to="link.route"
          :aria-current="link.route === currentRoute ? 'page' : undefined"
          class="inline-flex h-7.5 items-center justify-center gap-2 whitespace-nowrap rounded-[9px] border px-2.5 py-1.5 text-sm leading-[16.1px] outline-none transition-[background-color,color,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none"
          :class="
            link.route === currentRoute
              ? 'border-transparent bg-surface-base font-medium text-ink-gray-8 shadow-sm'
              : 'border-transparent text-ink-gray-5 hover:bg-surface-gray-3/80 hover:text-ink-gray-7'
          "
        >
          {{ link.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'

// The strip between the tools of one family. These are pages, so they are links in a `<nav>`,
// not a form control.
//
// frappe-ui's TabButtons can render an option as a RouterLink, and that was tried first. It
// wraps every option in a reka radiogroup, which handles Space itself and cancels Enter, so
// neither key ever reached the anchor and the strip was reachable by mouse alone. Driving it
// from the emitted selection instead desynchronised reka's internal value from the bound one,
// and a second press then emitted nothing at all.
//
// A list of links needs none of that: Enter activates because the browser activates a link,
// Tab reaches each one, and `aria-current="page"` says which page you are on. The pill styling
// mirrors frappe-ui's own Pill so the strip looks unchanged.
defineProps({
  label: { type: String, required: true },
  links: { type: Array, required: true },
  currentRoute: { type: String, required: true },
})
</script>
