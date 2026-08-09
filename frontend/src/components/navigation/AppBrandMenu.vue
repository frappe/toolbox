<template>
  <div ref="root" class="relative">
    <!--
      Kept native: this row needs the label to fill between a left logo and a
      right chevron. frappe-ui Button lays children out with justify-center and
      renders its label in a content-sized span, so there is no supported way to
      make it grow. Same reason as the sidebar rows and the list rows in #108.
    -->
    <button
      ref="trigger"
      type="button"
      class="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
      :class="collapsed ? 'justify-center px-0' : ''"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-label="Toolbox menu"
      @click="toggle"
    >
      <img :src="logoUrl" alt="" class="size-7 shrink-0 rounded-lg" />
      <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-base font-semibold text-ink-gray-9">
        Toolbox
      </span>
      <Icon
        v-if="!collapsed"
        name="lucide-chevrons-up-down"
        class="size-4 shrink-0 text-ink-gray-5"
      />
    </button>

    <div
      v-if="open"
      role="menu"
      aria-label="Toolbox menu"
      class="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-64 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-base shadow-lg"
    >
      <div class="border-b border-outline-gray-2 px-3 py-3">
        <p class="text-sm font-semibold text-ink-gray-9">Free tools, no account</p>
        <p class="pt-1 text-xs leading-5 text-ink-gray-5">
          Nothing you type is stored on a server. Your settings stay in this browser.
        </p>
      </div>

      <div class="p-1">
        <RouterLink
          to="/settings"
          role="menuitem"
          class="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-gray-7 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          @click="handleNavigate"
        >
          <Icon name="lucide-settings-2" class="size-4 shrink-0" />
          <span>Settings</span>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, nextTick, ref, watch } from 'vue'
import { Icon } from 'frappe-ui'

defineProps({
  collapsed: { type: Boolean, default: false },
})

const emit = defineEmits(['navigate'])

const logoUrl = '/assets/toolbox/toolbox-logo.svg'

const open = ref(false)
const root = ref(null)
const trigger = ref(null)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function handleNavigate() {
  close()
  emit('navigate')
}

function onDocumentPointer(event) {
  if (root.value && !root.value.contains(event.target)) close()
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    close()
    nextTick(() => trigger.value?.focus())
  }
}

watch(open, (isOpen) => {
  const target = globalThis.document
  if (!target) return
  if (isOpen) {
    target.addEventListener('pointerdown', onDocumentPointer)
    target.addEventListener('keydown', onKeydown)
  } else {
    target.removeEventListener('pointerdown', onDocumentPointer)
    target.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  const target = globalThis.document
  target?.removeEventListener('pointerdown', onDocumentPointer)
  target?.removeEventListener('keydown', onKeydown)
})
</script>
