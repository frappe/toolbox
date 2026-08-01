import { frappeRequest } from 'frappe-ui'

import { useToolboxPreferences } from './useToolboxPreferences'

const PREFERENCES_API = 'toolbox.toolbox.doctype.toolbox_user_preference.toolbox_user_preference'
export const PREFERENCES_LOAD_TIMEOUT_MS = 8000
export const PREFERENCES_SAVE_TIMEOUT_MS = 8000

let activeSynchronizer = null

export function initializeToolboxPreferences({
  store = useToolboxPreferences(),
  request = frappeRequest,
  session = globalThis,
  loadTimeoutMs = PREFERENCES_LOAD_TIMEOUT_MS,
  saveTimeoutMs = PREFERENCES_SAVE_TIMEOUT_MS,
} = {}) {
  activeSynchronizer = new ToolboxPreferenceSynchronizer({
    store,
    request,
    session,
    loadTimeoutMs,
    saveTimeoutMs,
  })
  return activeSynchronizer.initialize()
}

export function retryToolboxPreferenceSync() {
  return activeSynchronizer?.reconnect() ?? Promise.resolve(null)
}

export class ToolboxPreferenceSynchronizer {
  constructor({ store, request, session, loadTimeoutMs, saveTimeoutMs }) {
    this.store = store
    this.request = request
    this.session = session
    this.loadTimeoutMs = loadTimeoutMs
    this.saveTimeoutMs = saveTimeoutMs
    this.loadPromise = null
  }

  async initialize() {
    if (!isLoggedInSession(this.session)) {
      this.store.mode.value = this.store.storage ? 'local' : 'memory'
      this.store.isReady.value = true
      return this.store
    }

    this.store.useRemotePersistence((payload) => this.save(payload))
    // Preference loading must never gate navigation or tool rendering.
    this.store.isReady.value = true
    await this.load()
    return this.store
  }

  async reconnect() {
    if (!isLoggedInSession(this.session)) return this.store
    if (this.store.remoteReady) {
      await this.store.retryRemoteSave()
      return this.store
    }

    await this.load()
    return this.store
  }

  load() {
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = requestWithTimeout(
      this.request,
      {
        url: `${PREFERENCES_API}.get_preferences`,
        method: 'GET',
      },
      this.loadTimeoutMs,
    )
      .then((preferences) => {
        this.store.completeRemoteLoad(preferences)
        this.store.syncError.value = ''
      })
      .catch(() => {
        this.store.syncError.value = 'Your saved preferences could not be loaded.'
      })
      .finally(() => {
        this.loadPromise = null
      })

    return this.loadPromise
  }

  save(payload) {
    return requestWithTimeout(
      this.request,
      {
        url: `${PREFERENCES_API}.update_preferences`,
        method: 'POST',
        params: { payload },
      },
      this.saveTimeoutMs,
    )
  }
}

export function isLoggedInSession(session = globalThis) {
  return session.is_logged_in === true && Boolean(session.user) && session.user !== 'Guest'
}

function requestWithTimeout(request, options, timeoutMs) {
  let timeoutId
  const requestPromise = Promise.resolve().then(() => request(options))
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Toolbox preference request timed out.')),
      timeoutMs,
    )
  })

  return Promise.race([requestPromise, timeoutPromise]).finally(() => clearTimeout(timeoutId))
}
