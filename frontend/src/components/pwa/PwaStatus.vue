<template>
  <Teleport to="body">
    <Transition name="pwa-status">
      <section
        v-if="pwa.updateReady.value"
        class="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-outline-gray-3 bg-surface-white p-3 shadow-lg lg:bottom-5"
        role="status"
        aria-live="polite"
        aria-label="Toolbox update available"
      >
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-gray-2 text-ink-gray-8"
        >
          <Icon name="lucide-refresh-cw" class="size-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-ink-gray-9">Update ready</p>
          <p class="text-sm leading-5 text-ink-gray-6">Refresh to use the latest Toolbox version.</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <Button variant="ghost" label="Later" @click="pwa.dismissUpdate" />
          <Button
            variant="solid"
            label="Update"
            :loading="pwa.updateApplying.value"
            @click="pwa.applyUpdate"
          />
        </div>
      </section>

      <div
        v-else-if="pwa.isOffline.value"
        class="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-outline-gray-3 bg-surface-white px-3 py-2 shadow-md lg:bottom-5"
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
import { Button, Icon } from 'frappe-ui'

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
