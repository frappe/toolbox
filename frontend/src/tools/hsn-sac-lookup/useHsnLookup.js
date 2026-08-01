import { computed, ref } from 'vue'

import { fetchHsnCatalog, fetchHsnDependencyStatus, requestIndiaComplianceInstall } from './api'
import { createHsnSearchIndex } from './search'
import { createHsnSnapshot, createHsnSnapshotStore } from './snapshotStore'

const POLL_INTERVAL_MS = 2_000

export function useHsnLookup({
  request,
  snapshotStore = createHsnSnapshotStore(),
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  now,
} = {}) {
  const dependency = ref(null)
  const catalog = ref(null)
  const snapshotRefreshedAt = ref('')
  const query = ref('')
  const loadState = ref('loading')
  const errorMessage = ref('')
  const installConfirmed = ref(false)
  let index = createHsnSearchIndex([])
  let pollTimer = null

  const results = computed(() => index.search(query.value))
  const canSearch = computed(() => Boolean(catalog.value) && ['ready', 'offline', 'stale'].includes(loadState.value))

  async function initialize() {
    loadState.value = 'loading'
    const snapshot = await snapshotStore.load()
    if (snapshot) useSnapshot(snapshot)

    try {
      dependency.value = await fetchHsnDependencyStatus('', request)
      if (dependency.value.state === 'ready') {
        await refreshCatalog()
      } else if (dependency.value.state === 'installing') {
        schedulePoll(dependency.value.taskId)
      } else if (catalog.value) {
        loadState.value = 'stale'
      } else {
        loadState.value = 'dependency'
      }
    } catch {
      if (catalog.value) {
        dependency.value = offlineDependency()
        loadState.value = 'offline'
        errorMessage.value = 'The site could not be checked. Using the saved browser snapshot.'
      } else {
        dependency.value = failedDependency()
        loadState.value = 'error'
      }
    }
  }

  async function refreshCatalog() {
    loadState.value = catalog.value ? 'refreshing' : 'loading'
    errorMessage.value = ''
    try {
      const response = await fetchHsnCatalog(catalog.value?.revision ?? '', request)
      if (!response.notModified) {
        const temporarySnapshot = createHsnSnapshot(response, now)
        if (!temporarySnapshot) throw new Error('Invalid catalog')
        const snapshot = await snapshotStore.save(response, now)
        useSnapshot(snapshot ?? { ...temporarySnapshot, snapshotRefreshedAt: '' })
        if (!snapshot) {
          errorMessage.value = 'Search is ready, but this browser could not save an offline snapshot.'
        }
      }
      loadState.value = 'ready'
    } catch {
      if (catalog.value) {
        loadState.value = 'stale'
        errorMessage.value = 'The latest HSN master could not be loaded. Using the saved snapshot.'
      } else {
        loadState.value = 'error'
        errorMessage.value = 'The HSN master is unavailable. Try again after the dependency is ready.'
      }
    }
  }

  async function install() {
    if (!installConfirmed.value) return
    dependency.value = {
      schemaVersion: 1,
      state: 'installing',
      title: 'Installing India Compliance',
      message: 'Sending the confirmed request to Frappe Cloud.',
    }
    try {
      dependency.value = await requestIndiaComplianceInstall(request)
      installConfirmed.value = false
      if (dependency.value.state === 'installing') schedulePoll(dependency.value.taskId)
    } catch {
      dependency.value = failedDependency()
    }
  }

  async function retry() {
    stopPolling()
    await initialize()
  }

  function useSavedSnapshot() {
    if (!catalog.value) return
    dependency.value = offlineDependency()
    loadState.value = 'stale'
  }

  function schedulePoll(taskId) {
    if (!taskId) return
    stopPolling()
    pollTimer = setTimer(async () => {
      try {
        dependency.value = await fetchHsnDependencyStatus(taskId, request)
        if (dependency.value.state === 'installing') schedulePoll(taskId)
        else if (dependency.value.state === 'ready') await refreshCatalog()
      } catch {
        dependency.value = failedDependency()
      }
    }, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollTimer !== null) clearTimer(pollTimer)
    pollTimer = null
  }

  function useSnapshot(snapshot) {
    catalog.value = snapshot.data
    snapshotRefreshedAt.value = snapshot.snapshotRefreshedAt
    index = createHsnSearchIndex(snapshot.data.records)
  }

  return {
    dependency,
    catalog,
    snapshotRefreshedAt,
    query,
    results,
    loadState,
    errorMessage,
    installConfirmed,
    canSearch,
    initialize,
    refreshCatalog,
    install,
    retry,
    useSavedSnapshot,
    stopPolling,
  }
}

function offlineDependency() {
  return {
    schemaVersion: 1,
    state: 'ready',
    title: 'Saved HSN snapshot',
    message: 'Search is available from this browser snapshot while the site is unreachable.',
  }
}

function failedDependency() {
  return {
    schemaVersion: 1,
    state: 'failed',
    title: 'Dependency check failed',
    message: 'Toolbox could not check India Compliance. Try again.',
  }
}
