import { getCurrentScope, onScopeDispose, watch } from 'vue'

import { useToolboxPreferences } from './useToolboxPreferences'

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

// Mirror the saved theme preference onto <html data-theme>, which is the switch
// frappe-ui's tokens read to flip every semantic colour to its dark value.
export function useTheme(options = {}) {
  const controller = new ThemeController(options)
  controller.start()
  if (getCurrentScope()) onScopeDispose(() => controller.stop())
  return controller
}

export class ThemeController {
  constructor({
    store = useToolboxPreferences(),
    root = resolveDocumentElement(),
    matchMedia = resolveMatchMedia(),
  } = {}) {
    this.store = store
    this.root = root
    this.matchMedia = matchMedia
    this.systemQuery = null
    this.onSystemChange = () => this.apply()
    this.stopWatch = null
  }

  start() {
    this.apply()
    this.stopWatch = watch(
      () => this.store.settings.theme,
      () => this.apply(),
    )
  }

  apply() {
    const theme = this.store.settings.theme
    this.syncSystemListener(theme)
    if (this.root) this.root.dataset.theme = this.resolve(theme)
  }

  resolve(theme) {
    if (theme === 'light' || theme === 'dark') return theme
    return this.systemQuery?.matches ? 'dark' : 'light'
  }

  // Track the OS colour scheme only while the preference follows the system.
  syncSystemListener(theme) {
    const followsSystem = theme !== 'light' && theme !== 'dark'
    if (followsSystem && !this.systemQuery && this.matchMedia) {
      this.systemQuery = this.matchMedia(DARK_MEDIA_QUERY)
      this.systemQuery.addEventListener?.('change', this.onSystemChange)
    } else if (!followsSystem && this.systemQuery) {
      this.systemQuery.removeEventListener?.('change', this.onSystemChange)
      this.systemQuery = null
    }
  }

  stop() {
    this.stopWatch?.()
    this.stopWatch = null
    if (this.systemQuery) {
      this.systemQuery.removeEventListener?.('change', this.onSystemChange)
      this.systemQuery = null
    }
  }
}

function resolveDocumentElement() {
  return globalThis.document?.documentElement ?? null
}

function resolveMatchMedia() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia.bind(globalThis)
    : null
}
