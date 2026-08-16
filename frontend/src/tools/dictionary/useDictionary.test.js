import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { getDatasetStatus, lookup, suggest } from './api'
import { SUGGEST_DEBOUNCE_MS, useDictionary } from './useDictionary'

vi.mock('./api', () => ({ lookup: vi.fn(), suggest: vi.fn(), getDatasetStatus: vi.fn() }))

const source = {
  name: 'WordNet 3.1',
  url: 'https://wordnet.princeton.edu/',
  license: 'WordNet License',
  licenseUrl: 'https://wordnet.princeton.edu/license-and-commercial-use',
  attribution: 'WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved.',
}
const readyResponse = {
  schemaVersion: 1,
  state: 'ready',
  word: 'set',
  senses: [
    { pos: 'noun', definition: 'a group of similar things', examples: ['a set of tools'], synonyms: ['collection'] },
    { pos: 'verb', definition: 'put into a specified state', examples: [], synonyms: [] },
  ],
  source,
  sourceUpdatedAt: '2026-07-01T00:00:00Z',
}

function createDictionary() {
  return useDictionary()
}

afterEach(() => vi.useRealTimers())

describe('dictionary lookup orchestration', () => {
  it('submits a word and exposes its ready senses', async () => {
    lookup.mockResolvedValue(readyResponse)
    const dict = createDictionary()
    dict.query.value = 'set'
    await dict.submit()

    expect(lookup).toHaveBeenCalledWith('set')
    expect(dict.state.value).toBe('ready')
    expect(dict.senses.value).toHaveLength(2)
    expect(dict.word.value).toBe('set')
    expect(dict.source.value.attribution).toContain('Princeton University')
  })

  it('surfaces suggestions when the word is missing', async () => {
    lookup.mockResolvedValue({ schemaVersion: 1, state: 'missing', word: 'teh', suggestions: ['tea', 'the', 'ten'] })
    const dict = createDictionary()
    await dict.selectWord('teh')

    expect(dict.state.value).toBe('missing')
    expect(dict.missSuggestions.value).toEqual(['tea', 'the', 'ten'])
    expect(dict.senses.value).toEqual([])
  })

  it('reports an unavailable dataset without fabricating a result', async () => {
    lookup.mockResolvedValue({ schemaVersion: 1, state: 'unavailable' })
    const dict = createDictionary()
    await dict.selectWord('set')

    expect(dict.state.value).toBe('unavailable')
    expect(dict.senses.value).toEqual([])
    expect(dict.word.value).toBe('')
  })

  it('falls back to an honest connection error on network failure', async () => {
    lookup.mockRejectedValue(new Error('offline'))
    const dict = createDictionary()
    await dict.selectWord('set')

    expect(dict.state.value).toBe('error')
    expect(dict.errorMessage.value).toContain('internet connection')
    expect(dict.senses.value).toEqual([])
  })

  it('marks the dataset unavailable when the status check returns no active release', async () => {
    getDatasetStatus.mockResolvedValue({ schemaVersion: 1, dictionary: null })
    const dict = createDictionary()
    await dict.loadStatus()

    expect(dict.datasetStatus.value).toBeNull()
    expect(dict.state.value).toBe('unavailable')
  })

  it('debounces typeahead suggestions into one settled call', async () => {
    vi.useFakeTimers()
    suggest.mockResolvedValue({ schemaVersion: 1, suggestions: ['set', 'seth', 'setup'] })
    const dict = createDictionary()
    dict.query.value = 's'
    await nextTick()
    dict.query.value = 'se'
    await nextTick()
    expect(suggest).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SUGGEST_DEBOUNCE_MS)
    expect(suggest).toHaveBeenCalledTimes(1)
    expect(suggest).toHaveBeenCalledWith('se')
    expect(dict.suggestions.value).toEqual(['set', 'seth', 'setup'])
  })
})
