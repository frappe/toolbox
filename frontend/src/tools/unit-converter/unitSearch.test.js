import { describe, expect, it } from 'vitest'

import { units } from './registry'
import { searchUnits } from './unitSearch'

function resultIds(query, options) {
  return searchUnits(query, options).map((unit) => unit.id)
}

describe('unit search', () => {
  it('returns registry order for an empty query', () => {
    expect(resultIds('')).toEqual(units.map((unit) => unit.id))
  })

  it.each([
    ['metres', 'meter'],
    ['ft²', 'square-foot'],
    ['sq ft', 'square-foot'],
    ['m2', 'square-meter'],
    ['°F', 'fahrenheit'],
    ['mph', 'mile-per-hour'],
    ['mins', 'minute'],
    ['MiB', 'mebibyte'],
    ['kmpl', 'kilometer-per-liter'],
    ['litres per 100 kilometres', 'liter-per-100-kilometers'],
  ])('finds %s as %s', (query, expectedUnitId) => {
    expect(resultIds(query)[0]).toBe(expectedUnitId)
  })

  it('ranks exact symbols ahead of partial matches', () => {
    expect(resultIds('m')[0]).toBe('meter')
    expect(resultIds('g')[0]).toBe('gram')
  })

  it('preserves case when ranking exact raw symbols', () => {
    expect(resultIds('b')[0]).toBe('bit')
    expect(resultIds('B')[0]).toBe('byte')
  })

  it('matches multi-token queries across names and aliases', () => {
    expect(resultIds('imperial mpg')).toContain('mile-per-imperial-gallon')
    expect(resultIds('US fluid oz')[0]).toBe('us-fluid-ounce')
  })

  it('filters by category and applies a deterministic limit', () => {
    expect(resultIds('', { categoryId: 'temperature' })).toEqual([
      'kelvin',
      'celsius',
      'fahrenheit',
    ])
    expect(resultIds('mile', { categoryId: 'length', limit: 2 })).toEqual([
      'mile',
      'nautical-mile',
    ])
    expect(resultIds('', { limit: 0 })).toEqual([])
    expect(resultIds('', { categoryId: 'unknown' })).toEqual([])
  })

  it('returns no unrelated matches', () => {
    expect(resultIds('unfindable nonsense')).toEqual([])
  })

  it('keeps identical searches stable', () => {
    expect(resultIds('meter')).toEqual(resultIds('meter'))
  })

  it('validates search arguments', () => {
    expect(() => searchUnits(null)).toThrow(TypeError)
    expect(() => searchUnits('', { categoryId: null })).toThrow(TypeError)
    expect(() => searchUnits('', { limit: -1 })).toThrow(RangeError)
    expect(() => searchUnits('', { limit: 1.5 })).toThrow(RangeError)
  })
})
