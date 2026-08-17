<template>
  <!--
    The popover is frappe-ui's `Dropdown`, which is reka's `DropdownMenu` underneath: arrow keys
    move between the items, focus is trapped while it is open and returned when it closes, Escape
    and an outside click close it, and the content is portalled out of the sidebar's stacking
    context. All of that was hand-written here before (#278), and the arrow keys were missing —
    a `role="menu"` promises them.

    The trigger stays native. This row needs its label to fill between a left logo and a right
    chevron, and frappe-ui `Button` lays children out with `justify-center` and renders its label
    in a content-sized span, so there is no supported way to make it grow. Same reason as the
    sidebar rows and the list rows in #108. `Dropdown`'s `#trigger` slot is `as-child`, so the
    button below is the trigger rather than something wrapping it.
  -->
  <Dropdown :options="menuOptions" placement="bottom-start" @update:open="onOpenChange">
    <template #trigger="{ open }">
      <button
        type="button"
        class="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
        :class="collapsed ? 'justify-center px-0' : ''"
        :aria-expanded="open"
        aria-label="Toolbox menu"
      >
        <img :src="logoUrl" alt="" class="size-7 shrink-0 rounded-lg" />
        <span
          v-if="!collapsed"
          class="min-w-0 flex-1 truncate text-base font-semibold text-ink-gray-9"
        >
          Toolbox
        </span>
        <Icon
          v-if="!collapsed"
          name="lucide-chevrons-up-down"
          class="size-4 shrink-0 text-ink-gray-5"
        />
      </button>
    </template>

  </Dropdown>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Dropdown, Icon, sidebarCollapsedKey } from 'frappe-ui'

import BrandMenuSummary from './BrandMenuSummary.vue'

const emit = defineEmits(['navigate'])

// Read off the Sidebar, like every frappe-ui sidebar part. Only Sidebar knows the resolved state,
// because it falls back to the breakpoint when nothing sets the model.
const collapsed = inject(
  sidebarCollapsedKey,
  computed(() => false),
)

const logoUrl = '/assets/toolbox/toolbox-logo.svg'

// `Menu` pushes `route` through the router itself, so these need no click handler. The summary
// is a `disabled` component option, which renders the row and keeps it out of the arrow-key order.
const menuOptions = [
  { component: BrandMenuSummary, disabled: true },
  { label: 'About Toolbox', icon: 'lucide-info', route: '/about' },
  { label: 'Data sources', icon: 'lucide-database', route: '/data-sources' },
  { label: 'Settings', icon: 'lucide-settings-2', route: '/settings' },
]

// The mobile shell closes its sheet once a link is taken. The menu reports its own close, and a
// close after a route change is that navigation.
function onOpenChange(open) {
  if (!open) emit('navigate')
}
</script>
