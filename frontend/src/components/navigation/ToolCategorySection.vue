<template>
  <section class="pt-3">
    <template v-if="collapsed">
      <!-- The icon rail has no room for a heading, and no room to hide a tool behind one. -->
      <div class="mx-2 mb-1 border-t border-outline-gray-2" aria-hidden="true" />
      <div class="space-y-0.5">
        <slot />
      </div>
    </template>

    <template v-else>
      <!--
        A disclosure inside the heading, which is the pattern a screen reader expects: the heading
        names the group, and the button inside it opens the group.

        This is the one part of the sidebar frappe-ui cannot supply. `SidebarLabel` is a plain
        label, and the `SidebarSection` frappe-ui exports is the deprecated adapter for the old
        `sections` config prop. So the row is drawn here, to `SidebarLabel`'s own geometry — the
        same 28px height, the same gutter and the same label colour — while every tool inside it
        is a real `SidebarItem`.
      -->
      <h2>
        <button
          type="button"
          class="flex h-7 w-full items-center gap-2 rounded pl-2 pr-1 text-base text-ink-gray-5 transition-colors hover:text-ink-gray-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          :aria-expanded="open"
          :aria-controls="panelId"
          @click="$emit('toggle')"
        >
          <span class="min-w-0 flex-1 truncate text-left">{{ label }}</span>
          <!-- A closed category still says how much is inside it. `ink-gray-4` is the frappe-ui
               default for a count, and it fails contrast on this background at 2.68:1. -->
          <span class="shrink-0 tabular-nums text-sm text-ink-gray-5">{{ count }}</span>
          <Icon
            name="lucide-chevron-down"
            class="size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none"
            :class="open ? '' : '-rotate-90'"
          />
        </button>
      </h2>
      <div v-show="open" :id="panelId" class="space-y-0.5 pt-0.5">
        <slot />
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, inject, useId } from 'vue'
import { Icon, sidebarCollapsedKey } from 'frappe-ui'

defineProps({
  label: { type: String, required: true },
  count: { type: Number, required: true },
  open: { type: Boolean, default: false },
})

defineEmits(['toggle'])

// Read off the Sidebar rather than taken as a prop, the way every frappe-ui sidebar part does it,
// so nothing has to thread the state down. The fallback keeps the section usable on its own.
const collapsed = inject(
  sidebarCollapsedKey,
  computed(() => false),
)

// The shell renders a second sidebar inside the mobile sheet, so an id built from the category
// name would name two elements at once and `aria-controls` would point at whichever came first.
const panelId = useId()
</script>
