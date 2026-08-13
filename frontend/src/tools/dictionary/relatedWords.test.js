import { describe, expect, it } from 'vitest'

import { countRelatedWords, groupRelatedWords } from './relatedWords'

// The senses of "quiet", shortened. Five words repeat across senses, which is the case this
// exists for.
const QUIET = [
  { pos: 'noun', synonyms: ['repose', 'serenity', 'tranquillity', 'tranquility'] },
  { pos: 'noun', synonyms: ['silence'] },
  { pos: 'noun', synonyms: ['tranquillity', 'tranquility'] },
  { pos: 'verb', synonyms: ['calm', 'calm down', 'quieten', 'lull'] },
  { pos: 'verb', synonyms: ['quieten', 'hush'] },
  { pos: 'adjective', synonyms: [], antonyms: ['noisy'] },
  { pos: 'adverb', synonyms: ['quietly'] },
]

// WordNet records the opposite of "increase" against six separate senses, four of them nouns.
const INCREASE = [
  { pos: 'noun', synonyms: ['increment', 'growth'], antonyms: ['decrease'] },
  { pos: 'noun', synonyms: ['gain'], antonyms: ['decrease'] },
  { pos: 'noun', synonyms: [], antonyms: ['decrease', 'diminution'] },
  { pos: 'verb', synonyms: [], antonyms: ['decrease'] },
]

describe('grouping the synonyms of an entry', () => {
  it('gathers one list for each part of speech, across every sense', () => {
    // Three noun senses become one list of nouns. That is the whole point: a visitor asking for
    // another word for quiet gets an answer, rather than the same answer three times.
    expect(groupRelatedWords(QUIET, 'synonyms', 'quiet')).toEqual([
      { pos: 'noun', words: ['repose', 'serenity', 'tranquillity', 'tranquility', 'silence'] },
      { pos: 'verb', words: ['calm', 'calm down', 'quieten', 'lull', 'hush'] },
      { pos: 'adverb', words: ['quietly'] },
    ])
  })

  it('keeps a word once, in the order it was first offered', () => {
    const [nouns, verbs] = groupRelatedWords(QUIET, 'synonyms', 'quiet')

    expect(nouns.words.filter((word) => word === 'tranquillity')).toHaveLength(1)
    expect(verbs.words.filter((word) => word === 'quieten')).toHaveLength(1)
    expect(verbs.words.indexOf('quieten')).toBeLessThan(verbs.words.indexOf('hush'))
  })

  it('drops a part of speech that offers nothing', () => {
    expect(groupRelatedWords(QUIET, 'synonyms', 'quiet').map((group) => group.pos)).not.toContain('adjective')
  })

  it('never offers the word a visitor searched for', () => {
    const senses = [{ pos: 'noun', synonyms: ['Still', 'hush', 'still'] }]

    expect(groupRelatedWords(senses, 'synonyms', 'still')).toEqual([{ pos: 'noun', words: ['hush'] }])
  })

  it('reads an entry that carries no synonyms at all', () => {
    expect(groupRelatedWords([{ pos: 'noun', synonyms: [] }], 'synonyms', 'thing')).toEqual([])
    expect(groupRelatedWords([], 'synonyms', 'thing')).toEqual([])
    expect(groupRelatedWords(undefined, 'synonyms', 'thing')).toEqual([])
  })

  it('ignores a blank or missing entry in the list', () => {
    const senses = [{ pos: 'noun', synonyms: ['  ', '', 'calm', ' calm '] }]

    expect(groupRelatedWords(senses, 'synonyms', 'quiet')).toEqual([{ pos: 'noun', words: ['calm'] }])
  })

  it('counts what a visitor is shown, across every part of speech', () => {
    expect(countRelatedWords(groupRelatedWords(QUIET, 'synonyms', 'quiet'))).toBe(11)
    expect(countRelatedWords([])).toBe(0)
  })
})

describe('grouping the antonyms of an entry', () => {
  it('answers once for a word recorded as an opposite over and over', () => {
    expect(groupRelatedWords(INCREASE, 'antonyms', 'increase')).toEqual([
      { pos: 'noun', words: ['decrease', 'diminution'] },
      { pos: 'verb', words: ['decrease'] },
    ])
  })

  it('reads the two relations independently of each other', () => {
    // The adjective sense of "quiet" carries an antonym and no synonyms, so it is dropped from
    // one list and is the whole of the other.
    expect(groupRelatedWords(QUIET, 'antonyms', 'quiet')).toEqual([{ pos: 'adjective', words: ['noisy'] }])
  })

  it('reads an entry from a release that carries no antonyms at all', () => {
    const senses = [{ pos: 'noun', synonyms: ['hound'] }]

    expect(groupRelatedWords(senses, 'antonyms', 'dog')).toEqual([])
  })
})
