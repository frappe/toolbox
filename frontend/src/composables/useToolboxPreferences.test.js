import { describe, expect, it } from 'vitest'

import { tools } from '@/data/toolRegistry'
import {
  defaultSettings,
  MAX_RECENT_TOOLS,
  PREFERENCES_STORAGE_KEY,
  ToolboxPreferencesStore,
} from './useToolboxPreferences'

class MemoryStorage {
  constructor(initialValue = null, shouldThrow = false) {
    this.value = initialValue
    this.shouldThrow = shouldThrow
  }

  getItem() {
    if (this.shouldThrow) throw new Error('Storage unavailable')
    return this.value
  }

  setItem(key, value) {
    if (this.shouldThrow) throw new Error('Storage unavailable')
    expect(key).toBe(PREFERENCES_STORAGE_KEY)
    this.value = value
  }
}

describe('ToolboxPreferencesStore', () => {
  it('uses versioned defaults when storage is empty, corrupt, or outdated', () => {
    const values = [null, '{bad json', JSON.stringify({ version: 0 })]

    for (const value of values) {
      const store = new ToolboxPreferencesStore(new MemoryStorage(value))
      expect(store.snapshot()).toEqual({
        version: 1,
        favouriteToolIds: [],
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
    const stored = JSON.stringify({
      version: 1,
      favouriteToolIds: ['calculator', 'missing', 'calculator'],
      recentToolIds: [...tools.map((tool) => tool.id), 'calculator'],
      savedCurrencyPairs: [{ from: 'INR', to: 'USD' }, null, 'bad'],
      savedWeatherLocations: 'bad',
      savedWorldClockLocations: [{ zone: 'Asia/Kolkata' }],
      settings: { decimalPrecision: 4, timeFormat: 'invalid', unknown: true },
    })
    const store = new ToolboxPreferencesStore(new MemoryStorage(stored))

    expect(store.favouriteIds.value).toEqual(['calculator'])
    expect(store.recentToolIds.value).toEqual(
      tools.slice(0, MAX_RECENT_TOOLS).map((tool) => tool.id),
    )
    expect(store.savedCurrencyPairs.value).toEqual([{ from: 'INR', to: 'USD' }])
    expect(store.savedWeatherLocations.value).toEqual([])
    expect(store.savedWorldClockLocations.value).toEqual([{ zone: 'Asia/Kolkata' }])
    expect(store.settings.decimalPrecision).toBe(4)
    expect(store.settings.timeFormat).toBe(defaultSettings.timeFormat)
  })

  it('persists favourites and ten distinct recent tools', () => {
    const storage = new MemoryStorage()
    const store = new ToolboxPreferencesStore(storage)

    store.toggleFavourite('calculator')
    store.toggleFavourite('missing')
    for (const tool of tools) store.recordRecent(tool.id)
    store.recordRecent(tools[4].id)

    expect(store.favouriteIds.value).toEqual(['calculator'])
    expect(store.recentToolIds.value).toHaveLength(MAX_RECENT_TOOLS)
    expect(store.recentToolIds.value[0]).toBe(tools[4].id)
    expect(new Set(store.recentToolIds.value).size).toBe(MAX_RECENT_TOOLS)
    expect(JSON.parse(storage.value)).toEqual(store.snapshot())
  })

  it('toggles hidden tools, persists them, and ignores unknown ids', () => {
    const storage = new MemoryStorage()
    const store = new ToolboxPreferencesStore(storage)

    store.toggleHidden('weather')
    store.toggleHidden('missing')
    expect(store.isHidden('weather')).toBe(true)
    expect(store.isHidden('missing')).toBe(false)
    expect(store.hiddenIds.value).toEqual(['weather'])
    expect(JSON.parse(storage.value).hiddenToolIds).toEqual(['weather'])

    store.toggleHidden('weather')
    expect(store.isHidden('weather')).toBe(false)
    expect(store.hiddenIds.value).toEqual([])
  })

  it('accepts only supported settings and can reset them', () => {
    const store = new ToolboxPreferencesStore(new MemoryStorage())

    store.updateSetting('decimalPrecision', 6)
    store.updateSetting('decimalPrecision', 3)
    store.updateSetting('unknown', 'value')
    expect(store.settings.decimalPrecision).toBe(6)
    expect(store.settings.unknown).toBeUndefined()

    store.resetSettings()
    expect({ ...store.settings }).toEqual(defaultSettings)
  })

  it('persists a bounded world-clock location list', () => {
    const storage = new MemoryStorage()
    const store = new ToolboxPreferencesStore(storage)
    const locations = Array.from({ length: 14 }, (_, index) => ({ zone: `Etc/GMT+${index}` }))

    store.setSavedWorldClockLocations(locations)

    expect(store.savedWorldClockLocations.value).toHaveLength(12)
    expect(JSON.parse(storage.value).savedWorldClockLocations).toEqual(locations.slice(0, 12))
  })

  it('continues safely when browser storage throws', () => {
    const store = new ToolboxPreferencesStore(new MemoryStorage(null, true))

    expect(() => store.toggleFavourite('calculator')).not.toThrow()
    expect(store.favouriteIds.value).toEqual(['calculator'])
  })
})
