import { describe, expect, it } from 'vitest'

import { tools } from '@/data/toolRegistry'
import { searchTools } from './toolSearch'

function resultIds(query) {
  return searchTools(query, tools).map((tool) => tool.id)
}

describe('tool search', () => {
  it('returns the registry order for an empty query', () => {
    expect(resultIds('')).toEqual(tools.map((tool) => tool.id))
  })

  it.each([
    ['calculator', 'calculator'],
    ['calc', 'calculator'],
    ['calculatr', 'calculator'],
    ['math', 'calculator'],
    ['currency', 'currency-converter'],
    ['time zone', 'world-clock'],
    ['pin code', 'pin-code-search'],
    ['compound interest', 'financial-calculators'],
  ])('ranks %s with %s first', (query, expectedToolId) => {
    expect(resultIds(query)[0]).toBe(expectedToolId)
  })

  it('requires every token in a multi-token query', () => {
    expect(resultIds('time zone')).not.toContain('timer')
  })

  it('does not return unrelated low-scoring tools', () => {
    expect(resultIds('currency')).toEqual(['currency-converter'])
    expect(resultIds('unfindable nonsense')).toEqual([])
  })

  it('uses the tool name as a deterministic tie breaker', () => {
    const matchingTools = [
      { ...tools[0], id: 'zeta', name: 'Zeta', searchKeywords: ['shared'] },
      { ...tools[0], id: 'alpha', name: 'Alpha', searchKeywords: ['shared'] },
    ]

    expect(searchTools('shared', matchingTools).map((tool) => tool.id)).toEqual(['alpha', 'zeta'])
  })
})
