import { describe, expect, it } from 'vitest'

import {
  categoriesById,
  conversionRegistry,
  getCategory,
  getUnit,
  getUnitsByCategory,
  units,
  unitsById,
} from './registry'

const categoryIds = [
  'length',
  'area',
  'volume',
  'mass',
  'temperature',
  'speed',
  'time',
  'digital-storage',
  'fuel-consumption',
]

describe('unit conversion registry', () => {
  it('defines every V1 category in product order', () => {
    expect(conversionRegistry.map((category) => category.id)).toEqual(categoryIds)
  })

  it('defines a complete, unique unit schema', () => {
    expect(new Set(units.map((unit) => unit.id)).size).toBe(units.length)

    for (const category of conversionRegistry) {
      expect(category.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(category.name).toBeTruthy()
      expect(category.units.length).toBeGreaterThan(0)
      expect(getUnit(category.baseUnitId)?.category).toBe(category.id)

      for (const unit of category.units) {
        expect(unit.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        expect(unit.name).toBeTruthy()
        expect(unit.symbol).toBeTruthy()
        expect(unit.category).toBe(category.id)
        expect(unit.aliases.length).toBeGreaterThan(0)
        expect(unit.aliases.every((alias) => typeof alias === 'string' && alias)).toBe(true)
        expect(unit.toBase).toBeTypeOf('function')
        expect(unit.fromBase).toBeTypeOf('function')
      }
    }
  })

  it('indexes categories and units without stale references', () => {
    for (const category of conversionRegistry) {
      expect(categoriesById[category.id]).toBe(category)
      expect(getCategory(category.id)).toBe(category)
      expect(getUnitsByCategory(category.id)).toBe(category.units)

      for (const unit of category.units) {
        expect(unitsById[unit.id]).toBe(unit)
        expect(getUnit(unit.id)).toBe(unit)
      }
    }

    expect(getCategory('unknown')).toBeUndefined()
    expect(getUnit('unknown')).toBeUndefined()
    expect(getUnitsByCategory('unknown')).toEqual([])
  })

  it('is deeply immutable', () => {
    expect(Object.isFrozen(conversionRegistry)).toBe(true)
    expect(Object.isFrozen(categoriesById)).toBe(true)
    expect(Object.isFrozen(units)).toBe(true)
    expect(Object.isFrozen(unitsById)).toBe(true)

    for (const category of conversionRegistry) {
      expect(Object.isFrozen(category)).toBe(true)
      expect(Object.isFrozen(category.units)).toBe(true)

      for (const unit of category.units) {
        expect(Object.isFrozen(unit)).toBe(true)
        expect(Object.isFrozen(unit.aliases)).toBe(true)
      }
    }

    expect(() => conversionRegistry.push({})).toThrow(TypeError)
    expect(() => unitsById.meter.aliases.push('mutable')).toThrow(TypeError)
  })
})
