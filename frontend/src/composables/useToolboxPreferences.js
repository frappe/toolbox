import { reactive, ref } from 'vue'

import { toolsById } from '@/data/toolRegistry'

export const PREFERENCES_STORAGE_KEY = 'toolbox:preferences:v1'
export const MAX_RECENT_TOOLS = 10
export const REMOTE_SAVE_DELAY_MS = 250

export const settingOptions = Object.freeze({
  numberFormat: ['indian', 'international'],
  decimalPrecision: [0, 2, 4, 6],
  dateFormat: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
  timeFormat: ['12-hour', '24-hour'],
  defaultCurrency: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'],
  measurementSystem: ['metric', 'imperial'],
  temperatureUnit: ['celsius', 'fahrenheit'],
})

export const defaultSettings = Object.freeze({
  numberFormat: 'indian',
  decimalPrecision: 2,
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12-hour',
  defaultCurrency: 'INR',
  measurementSystem: 'metric',
  temperatureUnit: 'celsius',
})

export class ToolboxPreferencesStore {
  constructor(storage = resolveStorage()) {
    this.storage = storage
    this.remoteSave = null
    this.remoteReady = false
    this.remoteSaveTimer = null
    this.pendingRemoteOperations = []
    this.remoteSavePromise = null
    this.mode = ref(storage ? 'local' : 'memory')
    this.isReady = ref(true)
    this.isSaving = ref(false)
    this.syncError = ref('')
    const stored = this.read()
    this.favouriteIds = ref(stored.favouriteToolIds)
    this.recentToolIds = ref(stored.recentToolIds)
    this.savedCurrencyPairs = ref(stored.savedCurrencyPairs)
    this.savedWeatherLocations = ref(stored.savedWeatherLocations)
    this.savedWorldClockLocations = ref(stored.savedWorldClockLocations)
    this.settings = reactive(stored.settings)
  }

  isFavourite(toolId) {
    return this.favouriteIds.value.includes(toolId)
  }

  toggleFavourite(toolId) {
    if (!toolsById.has(toolId)) return

    const favourites = this.favouriteIds.value
    const isFavourite = !favourites.includes(toolId)
    this.favouriteIds.value = isFavourite
      ? [...favourites, toolId]
      : favourites.filter((id) => id !== toolId)
    this.persist({ type: 'setFavourite', toolId, isFavourite })
  }

  recordRecent(toolId) {
    if (!toolsById.has(toolId)) return

    this.recentToolIds.value = [
      toolId,
      ...this.recentToolIds.value.filter((id) => id !== toolId),
    ].slice(0, MAX_RECENT_TOOLS)
    this.persist({ type: 'prependRecent', toolId })
  }

  clearRecentTools() {
    this.recentToolIds.value = []
    this.persist({ type: 'clearRecent' })
  }

  updateSetting(key, value) {
    if (!isValidSetting(key, value)) return
    this.settings[key] = value
    this.persist({ type: 'setSetting', key, value })
  }

  resetSettings() {
    Object.assign(this.settings, defaultSettings)
    this.persist({ type: 'resetSettings' })
  }

  setSavedCurrencyPairs(pairs) {
    const normalized = normalizeCurrencyPairs(pairs)
    this.savedCurrencyPairs.value = normalized
    this.persist({ type: 'replaceSavedItems', field: 'savedCurrencyPairs', value: normalized })
  }

  setSavedWorldClockLocations(locations) {
    const normalized = normalizeObjectList(locations).slice(0, 12)
    this.savedWorldClockLocations.value = normalized
    this.persist({ type: 'replaceSavedItems', field: 'savedWorldClockLocations', value: normalized })
  }

  useRemotePersistence(save) {
    this.storage = null
    this.remoteSave = save
    this.remoteReady = false
    this.pendingRemoteOperations = []
    this.mode.value = 'frappe'
    this.hydrate(createDefaultPreferences())
  }

  completeRemoteLoad(value) {
    this.hydrate(value)
    applyPreferenceOperations(this, this.pendingRemoteOperations)

    this.remoteReady = true
    if (this.pendingRemoteOperations.length) this.scheduleRemoteSave()
  }

  hydrate(value) {
    const preferences = normalizePreferences(value)
    this.favouriteIds.value = preferences.favouriteToolIds
    this.recentToolIds.value = preferences.recentToolIds
    this.savedCurrencyPairs.value = preferences.savedCurrencyPairs
    this.savedWeatherLocations.value = preferences.savedWeatherLocations
    this.savedWorldClockLocations.value = preferences.savedWorldClockLocations
    Object.assign(this.settings, preferences.settings)
  }

  snapshot() {
    return {
      version: 1,
      favouriteToolIds: [...this.favouriteIds.value],
      recentToolIds: [...this.recentToolIds.value],
      savedCurrencyPairs: [...this.savedCurrencyPairs.value],
      savedWeatherLocations: [...this.savedWeatherLocations.value],
      savedWorldClockLocations: [...this.savedWorldClockLocations.value],
      settings: { ...this.settings },
    }
  }

  read() {
    const fallback = createDefaultPreferences()
    if (!this.storage) return fallback

    try {
      const value = this.storage.getItem(PREFERENCES_STORAGE_KEY)
      if (!value) return fallback
      return normalizePreferences(JSON.parse(value))
    } catch {
      return fallback
    }
  }

  persist(operation = null) {
    if (this.remoteSave) {
      if (operation) this.queueRemoteOperation(operation)
      return
    }

    if (!this.storage) return

    try {
      this.storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(this.snapshot()))
    } catch {
      // Storage can be unavailable in private browsing or hardened browsers.
    }
  }

  queueRemoteOperation(operation) {
    this.pendingRemoteOperations = compactPreferenceOperations([
      ...this.pendingRemoteOperations,
      operation,
    ])
    this.scheduleRemoteSave()
  }

  scheduleRemoteSave() {
    clearTimeout(this.remoteSaveTimer)
    if (!this.remoteReady || !this.pendingRemoteOperations.length) return
    this.syncError.value = ''
    this.remoteSaveTimer = setTimeout(() => {
      this.remoteSaveTimer = null
      void this.flushRemoteSave()
    }, REMOTE_SAVE_DELAY_MS)
  }

  async flushRemoteSave() {
    clearTimeout(this.remoteSaveTimer)
    this.remoteSaveTimer = null
    if (
      this.remoteSavePromise ||
      !this.remoteSave ||
      !this.remoteReady ||
      !this.pendingRemoteOperations.length
    ) {
      return this.remoteSavePromise
    }

    const operations = this.pendingRemoteOperations
    const payload = { version: 1, operations }
    this.pendingRemoteOperations = []
    this.isSaving.value = true
    let failed = false

    this.remoteSavePromise = this.remoteSave(payload)
      .then((saved) => {
        this.hydrate(saved)
        applyPreferenceOperations(this, this.pendingRemoteOperations)
        this.syncError.value = ''
        return saved
      })
      .catch(() => {
        failed = true
        this.pendingRemoteOperations = compactPreferenceOperations([
          ...operations,
          ...this.pendingRemoteOperations,
        ])
        this.syncError.value =
          'Your preferences could not be saved. Try again when you are online.'
        return null
      })
      .finally(() => {
        this.remoteSavePromise = null
        this.isSaving.value = false
        if (!failed && this.pendingRemoteOperations.length) this.scheduleRemoteSave()
      })

    return this.remoteSavePromise
  }

  retryRemoteSave() {
    if (!this.remoteSave || !this.remoteReady || !this.pendingRemoteOperations.length) return null
    return this.flushRemoteSave()
  }
}

const preferences = new ToolboxPreferencesStore()

export function useToolboxPreferences() {
  return preferences
}

export function createDefaultPreferences() {
  return {
    version: 1,
    favouriteToolIds: [],
    recentToolIds: [],
    savedCurrencyPairs: [],
    savedWeatherLocations: [],
    savedWorldClockLocations: [],
    settings: { ...defaultSettings },
  }
}

export function normalizePreferences(value) {
  const fallback = createDefaultPreferences()
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) {
    return fallback
  }

  return {
    version: 1,
    favouriteToolIds: normalizeToolIds(value.favouriteToolIds),
    recentToolIds: normalizeToolIds(value.recentToolIds).slice(0, MAX_RECENT_TOOLS),
    savedCurrencyPairs: normalizeObjectList(value.savedCurrencyPairs),
    savedWeatherLocations: normalizeObjectList(value.savedWeatherLocations),
    savedWorldClockLocations: normalizeObjectList(value.savedWorldClockLocations),
    settings: normalizeSettings(value.settings),
  }
}

function normalizeToolIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id) => typeof id === 'string' && toolsById.has(id)))]
}

function normalizeObjectList(value) {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
}

function normalizeCurrencyPairs(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const result = []
  for (const pair of value) {
    if (!pair || typeof pair !== 'object' || Array.isArray(pair)) continue
    const { baseCurrency, quoteCurrency } = pair
    if (!/^[A-Z]{3}$/.test(baseCurrency) || !/^[A-Z]{3}$/.test(quoteCurrency)) continue
    if (baseCurrency === quoteCurrency) continue
    const key = `${baseCurrency}:${quoteCurrency}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ baseCurrency, quoteCurrency })
    if (result.length === 20) break
  }
  return result
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

function resolveStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function applyPreferenceOperations(store, operations) {
  for (const operation of operations) {
    if (operation.type === 'setFavourite') {
      const favourites = store.favouriteIds.value
      store.favouriteIds.value = operation.isFavourite
        ? [...new Set([...favourites, operation.toolId])]
        : favourites.filter((toolId) => toolId !== operation.toolId)
    } else if (operation.type === 'prependRecent') {
      store.recentToolIds.value = [
        operation.toolId,
        ...store.recentToolIds.value.filter((toolId) => toolId !== operation.toolId),
      ].slice(0, MAX_RECENT_TOOLS)
    } else if (operation.type === 'clearRecent') {
      store.recentToolIds.value = []
    } else if (operation.type === 'setSetting') {
      store.settings[operation.key] = operation.value
    } else if (operation.type === 'resetSettings') {
      Object.assign(store.settings, defaultSettings)
    } else if (operation.type === 'replaceSavedItems') {
      const target = preferenceFieldTarget(store, operation.field)
      if (target) target.value = normalizeObjectList(operation.value)
    }
  }
}

function compactPreferenceOperations(operations) {
  const favourites = compactFavouriteOperations(operations)

  const lastRecentClear = findLastOperationIndex(operations, 'clearRecent')
  const recentOperations = operations
    .slice(lastRecentClear + 1)
    .filter(({ type }) => type === 'prependRecent')
  const recents = latestOperationsByKey(recentOperations, ({ toolId }) => toolId)
  if (lastRecentClear >= 0) recents.unshift({ type: 'clearRecent' })

  const lastSettingsReset = findLastOperationIndex(operations, 'resetSettings')
  const settingOperations = operations
    .slice(lastSettingsReset + 1)
    .filter(({ type }) => type === 'setSetting')
  const settings = latestOperationsByKey(settingOperations, ({ key }) => key)
  if (lastSettingsReset >= 0) settings.unshift({ type: 'resetSettings' })

  const savedItems = latestOperationsByKey(
    operations.filter(({ type }) => type === 'replaceSavedItems'),
    ({ field }) => field,
  )

  return [...favourites, ...recents, ...settings, ...savedItems]
}

function compactFavouriteOperations(operations) {
  const favouriteOperations = operations.filter(({ type }) => type === 'setFavourite')
  const latestByTool = new Map()

  favouriteOperations.forEach((operation, index) => {
    latestByTool.set(operation.toolId, { operation, index })
  })

  return [...latestByTool.values()]
    .sort((left, right) => left.index - right.index)
    .flatMap(({ operation, index }) => {
      if (!operation.isFavourite) return [operation]

      const earlierRemoval = findEarlierFavouriteRemoval(
        favouriteOperations,
        index,
        operation.toolId,
      )
      return earlierRemoval ? [earlierRemoval, operation] : [operation]
    })
}

function findEarlierFavouriteRemoval(operations, endIndex, toolId) {
  for (let index = endIndex - 1; index >= 0; index -= 1) {
    const operation = operations[index]
    if (operation.toolId === toolId && !operation.isFavourite) return operation
  }
  return null
}

function latestOperationsByKey(operations, getKey) {
  const seen = new Set()
  const latest = []
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const operation = operations[index]
    const key = getKey(operation)
    if (seen.has(key)) continue
    seen.add(key)
    latest.unshift(operation)
  }
  return latest
}

function findLastOperationIndex(operations, type) {
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    if (operations[index].type === type) return index
  }
  return -1
}

function preferenceFieldTarget(store, fieldName) {
  const targets = {
    favouriteToolIds: store.favouriteIds,
    recentToolIds: store.recentToolIds,
    savedCurrencyPairs: store.savedCurrencyPairs,
    savedWeatherLocations: store.savedWeatherLocations,
    savedWorldClockLocations: store.savedWorldClockLocations,
  }
  return targets[fieldName]
}
