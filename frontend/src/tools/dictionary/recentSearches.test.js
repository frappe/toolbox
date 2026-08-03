import { describe, expect, it } from 'vitest'

import {
  addRecentSearch,
  DICTIONARY_RECENT_STORAGE_KEY,
  loadRecentSearches,
  MAX_RECENT_WORDS,
  saveRecentSearches,
  validRecentPayload,
} from './recentSearches'

function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[DICTIONARY_RECENT_STORAGE_KEY, initial]])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

describe('dictionary recent searches', () => {
  it('round-trips a saved list through storage', () => {
    const storage = memoryStorage()
    saveRecentSearches(['apple', 'banana'], storage)
    expect(loadRecentSearches(storage)).toEqual(['apple', 'banana'])
  })

  it('caps the list at ten, most recent first', () => {
    const storage = memoryStorage()
    const words = Array.from({ length: 14 }, (_, index) => `word${index}`)
    const saved = saveRecentSearches(words, storage)
    expect(saved).toHaveLength(MAX_RECENT_WORDS)
    expect(saved[0]).toBe('word0')
    expect(loadRecentSearches(storage)).toHaveLength(MAX_RECENT_WORDS)
  })

  it('adds most-recent-first and dedupes case-insensitively', () => {
    const storage = memoryStorage()
    addRecentSearch('Apple', storage)
    addRecentSearch('banana', storage)
    const list = addRecentSearch('apple', storage)
    expect(list).toEqual(['apple', 'banana'])
  })

  it('rejects payloads that fail the schema guard', () => {
    expect(loadRecentSearches(memoryStorage('not json'))).toEqual([])
    expect(loadRecentSearches(memoryStorage(JSON.stringify({ version: 2, words: ['x'] })))).toEqual([])
    expect(loadRecentSearches(memoryStorage(JSON.stringify({ version: 1, words: 'nope' })))).toEqual([])
    expect(validRecentPayload({ version: 1, words: ['ok'] })).toBe(true)
    expect(validRecentPayload({ version: 1, words: [1, 2] })).toBe(false)
    expect(validRecentPayload(null)).toBe(false)
  })
})
