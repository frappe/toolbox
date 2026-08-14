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
        <p class="pt-2 text-xs leading-5 text-ink-gray-5">
          Made by
          <a
            class="font-medium text-ink-gray-7 underline underline-offset-2"
            href="https://frappe.io"
            target="_blank"
            rel="noreferrer"
            >Frappe</a
          >.
        </p>
      </div>

      <div class="p-1">
        <RouterLink
          to="/about"
          role="menuitem"
          class="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-gray-7 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          @click="handleNavigate"
        >
          <Icon name="lucide-info" class="size-4 shrink-0" />
          <span>About Toolbox</span>
        </RouterLink>
        <RouterLink
          to="/data-sources"
          role="menuitem"
          class="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-gray-7 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          @click="handleNavigate"
        >
          <Icon name="lucide-database" class="size-4 shrink-0" />
          <span>Data sources</span>
        </RouterLink>
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
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Icon, sidebarCollapsedKey } from 'frappe-ui'

const emit = defineEmits(['navigate'])

// Read off the Sidebar, like every frappe-ui sidebar part. Only Sidebar knows the resolved state,
// because it falls back to the breakpoint when nothing sets the model.
const collapsed = inject(
  sidebarCollapsedKey,
  computed(() => false),
)

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
