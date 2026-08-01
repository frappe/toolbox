import { describe, expect, it } from 'vitest'

import {
  MAX_RECENT_PAIRS,
  readRecentPairs,
  RECENT_PAIRS_STORAGE_KEY,
  useRecentUnitPairs,
} from './recentPairs'

const lengthPair = {
  categoryId: 'length',
  fromUnitId: 'meter',
  toUnitId: 'foot',
}

describe('recent unit pairs', () => {
  it('persists valid pairs without storing conversion values', () => {
    const recent = useRecentUnitPairs(localStorage)
    recent.record(lengthPair)

    expect(recent.pairs.value).toEqual([lengthPair])
    expect(JSON.parse(localStorage.getItem(RECENT_PAIRS_STORAGE_KEY))).toEqual([lengthPair])
    expect(localStorage.getItem(RECENT_PAIRS_STORAGE_KEY)).not.toContain('value')
  })

  it('moves a reversed pair to the front without duplicating it', () => {
    const recent = useRecentUnitPairs(localStorage)
    recent.record(lengthPair)
    recent.record({
      categoryId: 'temperature',
      fromUnitId: 'celsius',
      toUnitId: 'fahrenheit',
    })
    recent.record({ ...lengthPair, fromUnitId: 'foot', toUnitId: 'meter' })

    expect(recent.pairs.value).toEqual([
      { ...lengthPair, fromUnitId: 'foot', toUnitId: 'meter' },
      {
        categoryId: 'temperature',
        fromUnitId: 'celsius',
        toUnitId: 'fahrenheit',
      },
    ])
  })

  it('preserves stored order and rejects malformed entries', () => {
    const storedPairs = [
      lengthPair,
      { categoryId: 'time', fromUnitId: 'minute', toUnitId: 'hour' },
      { categoryId: 'length', fromUnitId: 'liter', toUnitId: 'meter' },
    ]
    localStorage.setItem(RECENT_PAIRS_STORAGE_KEY, JSON.stringify(storedPairs))

    expect(readRecentPairs(localStorage)).toEqual(storedPairs.slice(0, 2))
  })

  it('caps the persisted list and can clear it', () => {
    const recent = useRecentUnitPairs(localStorage)
    const pairs = [
      ['length', 'meter', 'foot'],
      ['area', 'square-meter', 'acre'],
      ['volume', 'liter', 'us-gallon'],
      ['mass', 'kilogram', 'pound'],
      ['temperature', 'celsius', 'fahrenheit'],
      ['speed', 'kilometer-per-hour', 'mile-per-hour'],
      ['time', 'minute', 'hour'],
    ]

    for (const [categoryId, fromUnitId, toUnitId] of pairs) {
      recent.record({ categoryId, fromUnitId, toUnitId })
    }

    expect(recent.pairs.value).toHaveLength(MAX_RECENT_PAIRS)
    recent.clear()
    expect(recent.pairs.value).toEqual([])
    expect(localStorage.getItem(RECENT_PAIRS_STORAGE_KEY)).toBeNull()
  })

  it('keeps working when storage is unavailable', () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const recent = useRecentUnitPairs(blockedStorage)

    expect(() => recent.record(lengthPair)).not.toThrow()
    expect(recent.pairs.value).toEqual([lengthPair])
    expect(() => recent.clear()).not.toThrow()
  })
})
