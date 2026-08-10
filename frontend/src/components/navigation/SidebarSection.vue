<template>
  <section class="pt-5">
    <template v-if="collapsed">
      <!-- The icon rail has no room for a heading, and no room to hide a tool behind one. -->
      <div class="mx-2 mb-2 border-t border-outline-gray-2" aria-hidden="true" />
      <div class="space-y-0.5">
        <slot />
      </div>
    </template>

    <template v-else>
      <!-- A disclosure inside the heading, which is the pattern a screen reader expects: the
           heading names the group, and the button inside it opens the group. -->
      <h2>
        <button
          :id="`${sectionId}-toggle`"
          type="button"
          class="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-xs font-medium uppercase tracking-wide text-ink-gray-5 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          :aria-expanded="open"
          :aria-controls="sectionId"
          @click="$emit('toggle')"
        >
          <span class="min-w-0 flex-1 truncate text-left">{{ label }}</span>
          <!-- A closed category still says how much is inside it. -->
          <span class="shrink-0 tabular-nums text-ink-gray-5">{{ count }}</span>
          <Icon
            name="lucide-chevron-down"
            class="size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none"
            :class="open ? '' : '-rotate-90'"
          />
        </button>
      </h2>
      <div v-show="open" :id="sectionId" class="space-y-0.5 pt-1">
        <slot />
      </div>
    </template>
  </section>
</template>

<script setup>
import { useId } from 'vue'
import { Icon } from 'frappe-ui'

defineProps({
  label: { type: String, required: true },
  count: { type: Number, required: true },
  open: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
})

defineEmits(['toggle'])

// The shell renders a second sidebar inside the mobile sheet, so an id built from the category
// name would name two elements at once and `aria-controls` would point at whichever came first.
const sectionId = useId()
</script>
