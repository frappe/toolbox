import { describe, expect, it } from 'vitest'

import { countSynonyms, groupSynonyms } from './synonyms'

// The senses of "quiet", shortened. Five words repeat across senses, which is the case this
// exists for.
const QUIET = [
  { pos: 'noun', synonyms: ['repose', 'serenity', 'tranquillity', 'tranquility'] },
  { pos: 'noun', synonyms: ['silence'] },
  { pos: 'noun', synonyms: ['tranquillity', 'tranquility'] },
  { pos: 'verb', synonyms: ['calm', 'calm down', 'quieten', 'lull'] },
  { pos: 'verb', synonyms: ['quieten', 'hush'] },
  { pos: 'adjective', synonyms: [] },
  { pos: 'adverb', synonyms: ['quietly'] },
]

describe('grouping the synonyms of an entry', () => {
  it('gathers one list for each part of speech, across every sense', () => {
    // Three noun senses become one list of nouns. That is the whole point: a visitor asking for
    // another word for quiet gets an answer, rather than the same answer three times.
    expect(groupSynonyms(QUIET, 'quiet')).toEqual([
      { pos: 'noun', words: ['repose', 'serenity', 'tranquillity', 'tranquility', 'silence'] },
      { pos: 'verb', words: ['calm', 'calm down', 'quieten', 'lull', 'hush'] },
      { pos: 'adverb', words: ['quietly'] },
    ])
  })

  it('keeps a word once, in the order it was first offered', () => {
    const [nouns, verbs] = groupSynonyms(QUIET, 'quiet')

    expect(nouns.words.filter((word) => word === 'tranquillity')).toHaveLength(1)
    expect(verbs.words.filter((word) => word === 'quieten')).toHaveLength(1)
    expect(verbs.words.indexOf('quieten')).toBeLessThan(verbs.words.indexOf('hush'))
  })

  it('drops a part of speech that offers nothing', () => {
    expect(groupSynonyms(QUIET, 'quiet').map((group) => group.pos)).not.toContain('adjective')
  })

  it('never offers the word a visitor searched for', () => {
    const senses = [{ pos: 'noun', synonyms: ['Still', 'hush', 'still'] }]

    expect(groupSynonyms(senses, 'still')).toEqual([{ pos: 'noun', words: ['hush'] }])
  })

  it('reads an entry that carries no synonyms at all', () => {
    expect(groupSynonyms([{ pos: 'noun', synonyms: [] }], 'thing')).toEqual([])
    expect(groupSynonyms([], 'thing')).toEqual([])
    expect(groupSynonyms(undefined, 'thing')).toEqual([])
  })

  it('ignores a blank or missing entry in the list', () => {
    const senses = [{ pos: 'noun', synonyms: ['  ', '', 'calm', ' calm '] }]

    expect(groupSynonyms(senses, 'quiet')).toEqual([{ pos: 'noun', words: ['calm'] }])
  })

  it('counts what a visitor is shown, across every part of speech', () => {
    expect(countSynonyms(groupSynonyms(QUIET, 'quiet'))).toBe(11)
    expect(countSynonyms([])).toBe(0)
  })
})
