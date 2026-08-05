<template>
  <!-- The "update ready" action lives in the sidebar footer (AppSidebar); this only shows the
       transient offline status. -->
  <Teleport to="body">
    <Transition name="pwa-status">
      <div
        v-if="pwa.isOffline.value"
        class="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-outline-gray-3 bg-surface-base px-3 py-2 shadow-md lg:bottom-5"
        role="status"
        aria-live="polite"
      >
        <Icon name="lucide-wifi-off" class="size-4 shrink-0 text-ink-gray-7" />
        <span class="whitespace-nowrap text-sm font-medium text-ink-gray-8">
          {{ offlineMessage }}
        </span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { Icon } from 'frappe-ui'

import { usePwaStatus } from '@/composables/usePwaStatus'

const pwa = usePwaStatus()
const offlineMessage = computed(() =>
  pwa.registrationFailed.value
    ? 'Offline. Reconnect to reload Toolbox.'
    : 'Offline. Local tools remain available.',
)

onMounted(pwa.initialize)
</script>

<style scoped>
.pwa-status-enter-active,
.pwa-status-leave-active {
  transition: opacity 160ms ease;
}

.pwa-status-enter-from,
.pwa-status-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pwa-status-enter-active,
  .pwa-status-leave-active {
    transition: none;
  }
}
</style>
