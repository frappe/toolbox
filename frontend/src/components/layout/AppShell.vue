<template>
  <div
    class="flex h-dvh min-h-0 bg-surface-base text-ink-gray-9"
    :data-density="layout.density"
    :data-surface="layout.surface"
  >
    <a
      href="#main-content"
      class="fixed left-3 top-3 z-[60] -translate-y-20 rounded-lg bg-surface-gray-7 px-3 py-2 text-sm font-medium text-ink-white focus:translate-y-0"
    >
      Skip to content
    </a>

    <AppSidebar class="hidden lg:flex" @search="searchOpen = true" />

    <BottomSheet v-model:open="mobileNavigationOpen" title="Navigate">
      <AppSidebar
        class="!h-[70vh] !w-full !bg-surface-base"
        :show-brand="false"
        @navigate="mobileNavigationOpen = false"
        @search="openSearchFromMobile"
      />
    </BottomSheet>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-14 shrink-0 items-center border-b border-outline-gray-2 bg-surface-base px-3 lg:hidden"
      >
        <Button
          variant="ghost"
          icon="lucide-menu"
          aria-label="Open navigation"
          :aria-expanded="mobileNavigationOpen"
          @click="mobileNavigationOpen = true"
        />
        <div class="flex min-w-0 flex-1 items-center gap-2 px-2">
          <img :src="logoUrl" alt="" class="size-6 rounded-md" />
          <span class="truncate text-base font-semibold">Toolbox</span>
        </div>
        <Button
          variant="ghost"
          icon="lucide-search"
          aria-label="Search tools"
          @click="searchOpen = true"
        />
      </header>

      <main id="main-content" class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-20 lg:pb-0">
        <slot />
      </main>

      <nav
        class="fixed inset-x-0 bottom-0 z-20 grid h-16 grid-cols-3 border-t border-outline-gray-2 bg-surface-base px-3 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Primary mobile navigation"
      >
        <RouterLink to="/" class="mobile-nav-item">
          <Icon name="lucide-house" class="size-5" />
          <span>Home</span>
        </RouterLink>
        <RouterLink to="/all-tools" class="mobile-nav-item text-ink-gray-9">
          <span class="flex size-9 items-center justify-center rounded-xl bg-surface-gray-7 text-ink-white">
            <Icon name="lucide-layout-grid" class="size-5" />
          </span>
          <span>All tools</span>
        </RouterLink>
        <button type="button" class="mobile-nav-item" @click="searchOpen = true">
          <Icon name="lucide-search" class="size-5" />
          <span>Search</span>
        </button>
      </nav>
    </div>

    <ToolSearchDialog v-model="searchOpen" />
    <PwaStatus />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { BottomSheet, Button, Icon } from 'frappe-ui'

import { useLayoutPreferences } from '@/composables/useLayoutPreferences'
import PwaStatus from '@/components/pwa/PwaStatus.vue'
import ToolSearchDialog from '@/components/search/ToolSearchDialog.vue'
import AppSidebar from '@/components/navigation/AppSidebar.vue'

const layout = useLayoutPreferences()
const logoUrl = '/assets/toolbox/toolbox-logo.svg'
const mobileNavigationOpen = ref(false)
const searchOpen = ref(false)

provide('openToolSearch', () => (searchOpen.value = true))

function openSearchFromMobile() {
  mobileNavigationOpen.value = false
  searchOpen.value = true
}

function handleShortcut(event) {
  const target = event.target
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
  if (isTyping) return

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchOpen.value = true
  }
}

onMounted(() => window.addEventListener('keydown', handleShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcut))
</script>
