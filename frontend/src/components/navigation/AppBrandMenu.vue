<template>
  <div ref="root" class="relative">
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
      <div class="flex items-center gap-3 border-b border-outline-gray-2 px-3 py-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-gray-3 text-sm font-semibold text-ink-gray-7"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-ink-gray-9">{{ session.fullName }}</p>
          <p class="truncate text-xs text-ink-gray-5">
            {{ session.isLoggedIn ? session.user : 'Not signed in' }}
          </p>
        </div>
      </div>

      <div class="px-3 py-3">
        <p class="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
          Frappe Suite
        </p>
        <div class="grid grid-cols-3 gap-1">
          <a
            v-for="app in suiteApps"
            :key="app.id"
            :href="app.href"
            role="menuitem"
            class="flex flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-center text-ink-gray-7 transition-colors hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
            @click="close"
          >
            <span class="flex size-8 items-center justify-center rounded-lg bg-surface-gray-2">
              <Icon :name="app.icon" class="size-4" />
            </span>
            <span class="w-full truncate text-xs font-medium">{{ app.name }}</span>
          </a>
        </div>
      </div>

      <div class="border-t border-outline-gray-2 p-1">
        <RouterLink
          to="/settings"
          role="menuitem"
          class="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-gray-7 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          @click="handleNavigate"
        >
          <Icon name="lucide-settings-2" class="size-4 shrink-0" />
          <span>Settings</span>
        </RouterLink>
        <button
          v-if="session.isLoggedIn"
          type="button"
          role="menuitem"
          class="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-ink-gray-7 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          @click="onLogout"
        >
          <Icon name="lucide-log-out" class="size-4 shrink-0" />
          <span>Log out</span>
        </button>
        <a
          v-else
          :href="loginHref"
          role="menuitem"
          class="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-gray-7 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
        >
          <Icon name="lucide-log-in" class="size-4 shrink-0" />
          <span>Sign in</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, nextTick, ref, watch } from 'vue'
import { Icon } from 'frappe-ui'

import { suiteApps } from '@/data/suiteApps'
import { getToolboxSession, logoutToolbox, sessionInitials } from '@/utils/session'

defineProps({
  collapsed: { type: Boolean, default: false },
})

const emit = defineEmits(['navigate'])

const logoUrl = '/assets/toolbox/toolbox-logo.svg'
const loginHref = '/login?redirect-to=/toolbox'
const session = getToolboxSession()
const initials = sessionInitials(session)

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

function onLogout() {
  close()
  void logoutToolbox()
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
