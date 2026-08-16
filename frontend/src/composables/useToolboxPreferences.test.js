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
        settings: defaultSettings,
      })
    }
  })

  it('normalizes stored tool IDs, list shapes, and settings', () => {
    const stored = {
      version: 1,
      recentToolIds: [...tools.map((tool) => tool.id), 'calculator'],
      settings: { decimalPrecision: 4, timeFormat: 'invalid', unknown: true },
    }
    const store = storeWith(stored)

    expect(store.recentToolIds.value).toEqual(
      tools.slice(0, MAX_RECENT_TOOLS).map((tool) => tool.id),
    )
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

    store.toggleHidden('dictionary')
    store.toggleHidden('missing')
    expect(store.isHidden('dictionary')).toBe(true)
    expect(store.isHidden('missing')).toBe(false)
    expect(store.hiddenIds.value).toEqual(['dictionary'])
    expect(store.snapshot().hiddenToolIds).toEqual(['dictionary'])

    store.toggleHidden('dictionary')
    expect(store.isHidden('dictionary')).toBe(false)
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

  it('keeps the recent tools through a reset, because they are not settings', () => {
    const store = new ToolboxPreferencesStore()
    store.recordRecent('calculator')

    store.resetSettings()

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

  // The whole payload is serialised under one key, so a tab open across the deploy that removed
  // saved pairs and saved cities (#281, #283) still carries both. Reading has to drop them
  // rather than fail, and the next write has to leave them behind for good.
  it('ignores fields that were removed from the payload', () => {
    const store = storeWith({
      version: 1,
      hiddenToolIds: [],
      recentToolIds: ['calculator'],
      savedCurrencyPairs: [{ baseCurrency: 'USD', quoteCurrency: 'INR' }],
      savedWorldClockLocations: [{ zone: 'Asia/Kolkata' }],
      settings: { decimalPrecision: 4 },
    })

    expect(store.recentToolIds.value).toEqual(['calculator'])
    expect(store.settings.decimalPrecision).toBe(4)

    const snapshot = store.snapshot()
    expect(snapshot).not.toHaveProperty('savedCurrencyPairs')
    expect(snapshot).not.toHaveProperty('savedWorldClockLocations')
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

    store.toggleHidden('dictionary')
    store.recordRecent('calculator')

    const stored = JSON.parse(session.getItem(PREFERENCES_STORAGE_KEY))
    expect(stored.hiddenToolIds).toEqual(['dictionary'])
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

    expect(() => store.toggleHidden('dictionary')).not.toThrow()
    expect(store.isHidden('dictionary')).toBe(true)
  })
})
