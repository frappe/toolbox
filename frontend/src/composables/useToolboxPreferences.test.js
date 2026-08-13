import { describe, expect, it } from 'vitest'

import { tools } from '@/data/toolRegistry'
import {
  defaultSettings,
  MAX_RECENT_TOOLS,
  PREFERENCES_STORAGE_KEY,
  THEME_STORAGE_KEY,
  ToolboxPreferencesStore,
} from './useToolboxPreferences'

function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  }
}

// The store reads what the browser kept for this tab, so these exercise normalization the way a
// real reload does: through the stored JSON.
function storeWith(storedValue) {
  return new ToolboxPreferencesStore({
    session: fakeStorage({ [PREFERENCES_STORAGE_KEY]: JSON.stringify(storedValue) }),
    local: fakeStorage(),
  })
}

describe('ToolboxPreferencesStore', () => {
  it('uses versioned defaults when the record is empty, malformed, or outdated', () => {
    const values = [null, 'not an object', { version: 0 }]

    for (const value of values) {
      const store = storeWith(value)
      expect(store.snapshot()).toEqual({
        version: 1,
        hiddenToolIds: [],
        recentToolIds: [],
        savedCurrencyPairs: [],
        savedWeatherLocations: [],
        savedWorldClockLocations: [],
        settings: defaultSettings,
      })
    }
  })

  it('normalizes stored tool IDs, list shapes, and settings', () => {
    const stored = {
      version: 1,
      recentToolIds: [...tools.map((tool) => tool.id), 'calculator'],
      // Stored data is only as trustworthy as the browser it came from, so a pair is validated
      // on the way in exactly as it is on the way out.
      savedCurrencyPairs: [
        { baseCurrency: 'USD', quoteCurrency: 'INR' },
        { from: 'INR', to: 'USD' },
        null,
        'bad',
      ],
      savedWeatherLocations: 'bad',
      savedWorldClockLocations: [{ zone: 'Asia/Kolkata' }],
      settings: { decimalPrecision: 4, timeFormat: 'invalid', unknown: true },
    }
    const store = storeWith(stored)

    expect(store.recentToolIds.value).toEqual(
      tools.slice(0, MAX_RECENT_TOOLS).map((tool) => tool.id),
    )
    expect(store.savedCurrencyPairs.value).toEqual([{ baseCurrency: 'USD', quoteCurrency: 'INR' }])
    expect(store.savedWeatherLocations.value).toEqual([])
    expect(store.savedWorldClockLocations.value).toEqual([{ zone: 'Asia/Kolkata' }])
    expect(store.settings.decimalPrecision).toBe(4)
    expect(store.settings.timeFormat).toBe(defaultSettings.timeFormat)
  })

  it('keeps ten distinct recent tools, most recent first', () => {
    const store = new ToolboxPreferencesStore()

    for (const tool of tools) store.recordRecent(tool.id)
    store.recordRecent(tools[4].id)

    expect(store.recentToolIds.value).toHaveLength(MAX_RECENT_TOOLS)
    expect(store.recentToolIds.value[0]).toBe(tools[4].id)
    expect(new Set(store.recentToolIds.value).size).toBe(MAX_RECENT_TOOLS)
  })

  it('toggles hidden tools and ignores unknown ids', () => {
    const store = new ToolboxPreferencesStore()

    store.toggleHidden('weather')
    store.toggleHidden('missing')
    expect(store.isHidden('weather')).toBe(true)
    expect(store.isHidden('missing')).toBe(false)
    expect(store.hiddenIds.value).toEqual(['weather'])
    expect(store.snapshot().hiddenToolIds).toEqual(['weather'])

    store.toggleHidden('weather')
    expect(store.isHidden('weather')).toBe(false)
    expect(store.hiddenIds.value).toEqual([])
  })

  it('accepts only supported settings and can reset them', () => {
    const store = new ToolboxPreferencesStore()

    store.updateSetting('decimalPrecision', 6)
    store.updateSetting('decimalPrecision', 3)
    store.updateSetting('unknown', 'value')
    expect(store.settings.decimalPrecision).toBe(6)
    expect(store.settings.unknown).toBeUndefined()

    store.resetSettings()
    expect({ ...store.settings }).toEqual(defaultSettings)
  })

  it('brings back the hidden tools on reset, not just the typed settings', () => {
    const store = new ToolboxPreferencesStore()
    store.toggleHidden('calculator')
    store.toggleHidden('emi-calculator')
    store.updateSetting('decimalPrecision', 6)

    store.resetSettings()

    expect(store.hiddenIds.value).toEqual([])
    expect(store.settings.decimalPrecision).toBe(defaultSettings.decimalPrecision)
  })

  it('keeps a visitor\'s saved lists through a reset, because they are not settings', () => {
    const store = new ToolboxPreferencesStore()
    store.setSavedCurrencyPairs([{ baseCurrency: 'USD', quoteCurrency: 'INR' }])
    store.recordRecent('calculator')

    store.resetSettings()

    expect(store.savedCurrencyPairs.value).toHaveLength(1)
    expect(store.recentToolIds.value).toEqual(['calculator'])
  })

  it('defaults the theme to system and rejects an unsupported theme', () => {
    const store = new ToolboxPreferencesStore()
    expect(store.settings.theme).toBe('system')

    store.updateSetting('theme', 'dark')
    expect(store.settings.theme).toBe('dark')

    store.updateSetting('theme', 'sepia')
    expect(store.settings.theme).toBe('dark')
  })

  it('bounds the world-clock location list', () => {
    const store = new ToolboxPreferencesStore()
    const locations = Array.from({ length: 14 }, (_, index) => ({ zone: `Etc/GMT+${index}` }))

    store.setSavedWorldClockLocations(locations)

    expect(store.savedWorldClockLocations.value).toHaveLength(12)
    expect(store.snapshot().savedWorldClockLocations).toEqual(locations.slice(0, 12))
  })

  it('bounds the weather location list', () => {
    const store = new ToolboxPreferencesStore()
    const places = Array.from({ length: 14 }, (_, index) => ({ name: `City ${index}`, latitude: index, longitude: index }))

    store.setSavedWeatherLocations(places)

    expect(store.savedWeatherLocations.value).toHaveLength(12)
    expect(store.snapshot().savedWeatherLocations).toEqual(places.slice(0, 12))
  })

  it('tolerates a null options argument', () => {
    // Several call sites pass an explicit null, which a default parameter does not cover.
    expect(() => new ToolboxPreferencesStore(null)).not.toThrow()
  })
})

// Toolbox has no accounts and keeps nothing between visits. Everything a visitor does belongs in
// sessionStorage; only the theme survives, so a returning dark-mode visitor is not flashed white.
describe('ToolboxPreferencesStore storage split', () => {
  it('writes everything except the theme to sessionStorage', () => {
    const session = fakeStorage()
    const local = fakeStorage()
    const store = new ToolboxPreferencesStore({ session, local })

    store.toggleHidden('weather')
    store.recordRecent('calculator')

    const stored = JSON.parse(session.getItem(PREFERENCES_STORAGE_KEY))
    expect(stored.hiddenToolIds).toEqual(['weather'])
    expect(stored.recentToolIds).toEqual(['calculator'])
    expect(local.getItem(PREFERENCES_STORAGE_KEY)).toBeNull()
  })

  it('keeps the theme in localStorage and restores it on the next visit', () => {
    const local = fakeStorage()
    new ToolboxPreferencesStore({ session: fakeStorage(), local }).updateSetting('theme', 'dark')

    expect(local.getItem(THEME_STORAGE_KEY)).toBe('dark')

    // A new browser session: sessionStorage is empty, the theme still applies.
    const returning = new ToolboxPreferencesStore({ session: fakeStorage(), local })
    expect(returning.settings.theme).toBe('dark')
    expect(returning.hiddenIds.value).toEqual([])
    expect(returning.recentToolIds.value).toEqual([])
  })

  it('ignores a tampered theme and falls back to the default', () => {
    const store = new ToolboxPreferencesStore({
      session: fakeStorage(),
      local: fakeStorage({ [THEME_STORAGE_KEY]: 'sepia' }),
    })

    expect(store.settings.theme).toBe('system')
  })

  it('works when the browser blocks storage entirely', () => {
    const blocked = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    const store = new ToolboxPreferencesStore({ session: blocked, local: blocked })

    expect(() => store.toggleHidden('weather')).not.toThrow()
    expect(store.isHidden('weather')).toBe(true)
  })
})
