import { describe, expect, it } from 'vitest'

import { createHsnSearchIndex, normalizeText } from './search'

const records = [
  { code: '0101', description: 'Live horses, asses, mules and hinnies' },
  { code: '01012100', description: 'Pure-bred breeding horses' },
  { code: '09012120', description: 'Roasted coffee, not decaffeinated' },
  { code: '998313', description: 'Information technology consulting and support services' },
  { code: '998314', description: 'Information technology design and development services' },
]

describe('HSN and SAC search ranking', () => {
  const index = createHsnSearchIndex(records)

  it('ranks an exact code before longer code prefixes', () => {
    expect(index.search('0101').map(({ code }) => code)).toEqual(['0101', '01012100'])
  })

  it('supports code prefixes, phrases, and words in any order', () => {
    expect(index.search('9983').map(({ code }) => code)).toEqual(['998313', '998314'])
    expect(index.search('roasted coffee')[0].code).toBe('09012120')
    expect(index.search('support technology')[0].code).toBe('998313')
  })

  it('supports word prefixes and typo-tolerant search', () => {
    expect(index.search('consult tech')[0].code).toBe('998313')
    expect(index.search('cofee')[0].code).toBe('09012120')
  })

  it('uses a stable code order when ranks are equal', () => {
    expect(index.search('information technology').map(({ code }) => code)).toEqual([
      '998313',
      '998314',
    ])
  })

  it('normalizes punctuation and whitespace without retaining markup', () => {
    expect(normalizeText('  Live—HORSES / <b>  ')).toBe('live horses b')
  })

  it('searches a full-sized catalog within the interaction budget', () => {
    const largeIndex = createHsnSearchIndex(
      Array.from({ length: 18_700 }, (_, index) => ({
        code: String(10_000_000 + index),
        description: `Classification description number ${index}`,
      })),
    )
    const started = performance.now()
    const matches = largeIndex.search('100123')
    const fuzzyMatches = largeIndex.search('classificaton')
    const elapsed = performance.now() - started

    expect(matches.length).toBeGreaterThan(0)
    expect(fuzzyMatches.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(250)
  })
})
