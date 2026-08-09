import { describe, expect, it } from 'vitest'

import { tools } from '@/data/toolRegistry'
import {
  defaultSettings,
  MAX_RECENT_TOOLS,
  ToolboxPreferencesStore,
} from './useToolboxPreferences'

// The store starts from defaults and is filled by the per-user server record,
// so these exercise the same normalization through `hydrate`.
function storeWith(remoteValue) {
  const store = new ToolboxPreferencesStore()
  store.hydrate(remoteValue)
  return store
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
      savedCurrencyPairs: [{ from: 'INR', to: 'USD' }, null, 'bad'],
      savedWeatherLocations: 'bad',
      savedWorldClockLocations: [{ zone: 'Asia/Kolkata' }],
      settings: { decimalPrecision: 4, timeFormat: 'invalid', unknown: true },
    }
    const store = storeWith(stored)

    expect(store.recentToolIds.value).toEqual(
      tools.slice(0, MAX_RECENT_TOOLS).map((tool) => tool.id),
    )
    expect(store.savedCurrencyPairs.value).toEqual([{ from: 'INR', to: 'USD' }])
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

  it('records changes made before the remote record is attached', () => {
    const store = new ToolboxPreferencesStore()

    expect(() => store.toggleHidden('calculator')).not.toThrow()
    expect(store.hiddenIds.value).toEqual(['calculator'])
  })
})
