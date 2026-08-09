export const SERVICE_WORKER_URL = '/toolbox-sw.js'
export const SERVICE_WORKER_SCOPE = '/'

export class ToolboxServiceWorkerManager {
  constructor({ browserWindow = window, browserNavigator = navigator, callbacks = {} } = {}) {
    this.window = browserWindow
    this.serviceWorker = browserNavigator.serviceWorker
    this.callbacks = callbacks
    this.registration = null
    this.reloadForUpdate = false
    this.hasReloaded = false
    this.handleControllerChange = this.handleControllerChange.bind(this)
    this.handleUpdateFound = this.handleUpdateFound.bind(this)
  }

  get isSupported() {
    return Boolean(this.serviceWorker)
  }

  async register() {
    if (!this.isSupported) return null

    try {
      this.serviceWorker.addEventListener('controllerchange', this.handleControllerChange)
      this.registration = await this.serviceWorker.register(SERVICE_WORKER_URL, {
        scope: SERVICE_WORKER_SCOPE,
        updateViaCache: 'none',
      })
      this.registration.addEventListener('updatefound', this.handleUpdateFound)
      this.notifyIfUpdateIsWaiting()
      this.checkForUpdate()
      return this.registration
    } catch (error) {
      this.serviceWorker.removeEventListener('controllerchange', this.handleControllerChange)
      this.callbacks.onRegistrationError?.(error)
      return null
    }
  }

  applyWaitingUpdate() {
    const waitingWorker = this.registration?.waiting
    if (!waitingWorker) return false

    this.reloadForUpdate = true
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    return true
  }

  destroy() {
    this.serviceWorker?.removeEventListener('controllerchange', this.handleControllerChange)
    this.registration?.removeEventListener('updatefound', this.handleUpdateFound)
  }

  checkForUpdate() {
    this.registration?.update().catch(() => {})
  }

  handleUpdateFound() {
    const installingWorker = this.registration?.installing
    if (!installingWorker) return

    const handleStateChange = () => {
      if (installingWorker.state !== 'installed') return
      installingWorker.removeEventListener('statechange', handleStateChange)

      if (this.serviceWorker.controller) {
        this.callbacks.onUpdateReady?.()
      }
    }
    installingWorker.addEventListener('statechange', handleStateChange)
  }

  handleControllerChange() {
    if (!this.reloadForUpdate || this.hasReloaded) return

    this.hasReloaded = true
    this.callbacks.onUpdateActivated?.()
    this.window.location.reload()
  }

  notifyIfUpdateIsWaiting() {
    if (this.registration?.waiting && this.serviceWorker.controller) {
      this.callbacks.onUpdateReady?.()
    }
  }
}
