import { reactive, ref } from 'vue'

import { toolsById } from '@/data/toolRegistry'

export const MAX_RECENT_TOOLS = 10

// Toolbox has no accounts and keeps nothing between visits, so preferences live in
// `sessionStorage`: they last as long as the tab and then go.
//
// `theme` is the one exception, and it is deliberate. It is a display choice rather than a record
// of what somebody did, and holding it in `sessionStorage` would flash a returning dark-mode
// visitor with a white page on every visit. It goes to `localStorage` on its own key.
export const PREFERENCES_STORAGE_KEY = 'toolbox:preferences:v1'
export const THEME_STORAGE_KEY = 'toolbox:theme:v1'

export const settingOptions = Object.freeze({
  numberFormat: ['indian', 'international'],
  decimalPrecision: [0, 2, 4, 6],
  dateFormat: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
  timeFormat: ['12-hour', '24-hour'],
  defaultCurrency: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'],
  measurementSystem: ['metric', 'imperial'],
  temperatureUnit: ['celsius', 'fahrenheit'],
  theme: ['system', 'light', 'dark'],
})

export const defaultSettings = Object.freeze({
  numberFormat: 'indian',
  decimalPrecision: 2,
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12-hour',
  defaultCurrency: 'INR',
  measurementSystem: 'metric',
  temperatureUnit: 'celsius',
  theme: 'system',
})

export class ToolboxPreferencesStore {
  // `options` is read defensively rather than destructured in the signature: callers pass an
  // explicit null, and a default parameter only fills in for undefined.
  constructor(options) {
    const {
      session = resolveStorage('sessionStorage'),
      local = resolveStorage('localStorage'),
    } = options ?? {}
    this.session = session
    this.local = local
    this.isReady = ref(true)

    const initial = this.read()
    this.hiddenIds = ref(initial.hiddenToolIds)
    this.recentToolIds = ref(initial.recentToolIds)
    this.settings = reactive(initial.settings)
  }

  isHidden(toolId) {
    return this.hiddenIds.value.includes(toolId)
  }

  toggleHidden(toolId) {
    if (!toolsById.has(toolId)) return

    const hidden = this.hiddenIds.value
    this.hiddenIds.value = hidden.includes(toolId)
      ? hidden.filter((id) => id !== toolId)
      : [...hidden, toolId]
    this.persist()
  }

  recordRecent(toolId) {
    if (!toolsById.has(toolId)) return

    this.recentToolIds.value = [
      toolId,
      ...this.recentToolIds.value.filter((id) => id !== toolId),
    ].slice(0, MAX_RECENT_TOOLS)
    this.persist()
  }

  clearRecentTools() {
    this.recentToolIds.value = []
    this.persist()
  }

  updateSetting(key, value) {
    if (!isValidSetting(key, value)) return
    this.settings[key] = value
    this.persist()
  }

  // Everything the Settings page controls, which is the typed preferences and the tool list.
  // It used to reset the preferences alone, so a visitor who had hidden a tool pressed Reset and
  // watched nothing happen: the hidden tools are the larger half of that page.
  //
  // Recent tools are left alone. They are not settings, they are not shown here, and losing them
  // to a button pressed about a number format would be a surprise.
  resetSettings() {
    Object.assign(this.settings, defaultSettings)
    this.hiddenIds.value = []
    this.persist()
  }

  snapshot() {
    return {
      version: 1,
      hiddenToolIds: [...this.hiddenIds.value],
      recentToolIds: [...this.recentToolIds.value],
      settings: { ...this.settings },
    }
  }

  read() {
    const preferences = normalizePreferences(parseJson(safeGet(this.session, PREFERENCES_STORAGE_KEY)))
    const theme = safeGet(this.local, THEME_STORAGE_KEY)
    if (isValidSetting('theme', theme)) preferences.settings.theme = theme
    return preferences
  }

  persist() {
    safeSet(this.session, PREFERENCES_STORAGE_KEY, JSON.stringify(this.snapshot()))
    safeSet(this.local, THEME_STORAGE_KEY, this.settings.theme)
  }
}

const preferences = new ToolboxPreferencesStore()

export function useToolboxPreferences() {
  return preferences
}

export function createDefaultPreferences() {
  return {
    version: 1,
    hiddenToolIds: [],
    recentToolIds: [],
    settings: { ...defaultSettings },
  }
}

export function normalizePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) {
    return createDefaultPreferences()
  }

  return {
    version: 1,
    hiddenToolIds: normalizeToolIds(value.hiddenToolIds),
    recentToolIds: normalizeToolIds(value.recentToolIds).slice(0, MAX_RECENT_TOOLS),
    settings: normalizeSettings(value.settings),
  }
}

// Storage throws rather than returning null when a browser blocks it (Safari private mode, a
// blocked third-party context). Every access is guarded so a blocked visitor still gets a working
// tool, just one that forgets on reload.
function resolveStorage(kind) {
  try {
    return globalThis[kind] ?? null
  } catch {
    return null
  }
}

function safeGet(storage, key) {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem(key, value)
  } catch {
    // Out of quota or blocked. The in-memory state stays correct for this tab.
  }
}

function parseJson(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeToolIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id) => typeof id === 'string' && toolsById.has(id)))]
}


function normalizeSettings(value) {
  const settings = { ...defaultSettings }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return settings

  for (const [key, settingValue] of Object.entries(value)) {
    if (isValidSetting(key, settingValue)) settings[key] = settingValue
  }
  return settings
}

function isValidSetting(key, value) {
  return settingOptions[key]?.includes(value) ?? false
}
