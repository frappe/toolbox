import { readonly, ref } from 'vue'

import { ToolboxServiceWorkerManager } from '@/pwa/serviceWorkerRegistration'
import { retryToolboxPreferenceSync } from '@/composables/toolboxPreferenceSync'

const isOffline = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false)
const updateReady = ref(false)
const updateApplying = ref(false)
const registrationFailed = ref(false)

let initialized = false
let manager = null

export function usePwaStatus() {
  return {
    isOffline: readonly(isOffline),
    updateReady: readonly(updateReady),
    updateApplying: readonly(updateApplying),
    registrationFailed: readonly(registrationFailed),
    initialize,
    applyUpdate,
    dismissUpdate,
  }
}

async function initialize() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  if (import.meta.env.DEV) return

  manager = new ToolboxServiceWorkerManager({
    callbacks: {
      onUpdateReady: () => {
        updateReady.value = true
      },
      onRegistrationError: () => {
        registrationFailed.value = true
      },
    },
  })
  const registration = await manager.register()
  if (!registration) registrationFailed.value = true
}

function applyUpdate() {
  if (!manager?.applyWaitingUpdate()) return
  updateApplying.value = true
}

function dismissUpdate() {
  updateReady.value = false
}

function handleOnline() {
  isOffline.value = false
  manager?.checkForUpdate()
  void retryToolboxPreferenceSync()
}

function handleOffline() {
  isOffline.value = true
}
