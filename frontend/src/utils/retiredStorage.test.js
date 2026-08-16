import { describe, expect, it } from 'vitest'

import { clearRetiredStorage } from './retiredStorage'

function storageWith(entries) {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => map.delete(key),
    read: () => Object.fromEntries(map),
  }
}

describe('clearRetiredStorage', () => {
  it('removes every per-tool history key, whatever the tool id', () => {
    const storage = storageWith({
      'toolbox:history:unit-converter:v1': '[]',
      'toolbox:history:gst-calculator:v1': '[]',
      // The financial calculators prefixed their own ids, so the key is doubly qualified.
      'toolbox:history:financial-emi:v1': '[]',
    })

    clearRetiredStorage(storage)

    expect(storage.read()).toEqual({})
  })

  it('removes the calculator log and the dictionary recents', () => {
    const storage = storageWith({
      'toolbox:calculator-history:v1': '[]',
      'toolbox:dictionary-recent:v1': '["right"]',
    })

    clearRetiredStorage(storage)

    expect(storage.read()).toEqual({})
  })

  it('leaves every key that is still in use', () => {
    const kept = {
      'toolbox:preferences:v1': '{}',
      'toolbox:timer-workspace:v1': '{}',
      'toolbox:theme:v1': 'dark',
      'toolbox:sidebar-collapsed:v1': 'true',
      'toolbox:currency-reference-rates:v1': '{}',
    }
    const storage = storageWith({ ...kept, 'toolbox:history:speed-converter:v1': '[]' })

    clearRetiredStorage(storage)

    expect(storage.read()).toEqual(kept)
  })

  it('says nothing when the browser blocks storage', () => {
    expect(() => clearRetiredStorage(undefined)).not.toThrow()
    expect(() =>
      clearRetiredStorage({
        get length() {
          throw new Error('blocked')
        },
      }),
    ).not.toThrow()
  })
})
