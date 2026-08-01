import { describe, expect, it } from 'vitest'

import { convert, convertAndSwap, swapUnits, UnitConversionError } from './converter'
import { conversionRegistry, getUnit, units } from './registry'

const linearBaseFactors = {
  meter: 1,
  kilometer: 1_000,
  centimeter: 0.01,
  millimeter: 0.001,
  inch: 0.0254,
  foot: 0.3048,
  yard: 0.9144,
  mile: 1_609.344,
  'nautical-mile': 1_852,
  'square-meter': 1,
  'square-kilometer': 1_000_000,
  'square-centimeter': 0.0001,
  'square-millimeter': 0.000001,
  hectare: 10_000,
  acre: 4_046.8564224,
  'square-foot': 0.09290304,
  'square-yard': 0.83612736,
  'square-mile': 2_589_988.110336,
  liter: 1,
  milliliter: 0.001,
  'cubic-meter': 1_000,
  'cubic-centimeter': 0.001,
  'cubic-inch': 0.016387064,
  'cubic-foot': 28.316846592,
  'us-gallon': 3.785411784,
  'imperial-gallon': 4.54609,
  'us-fluid-ounce': 0.0295735295625,
  kilogram: 1,
  gram: 0.001,
  milligram: 0.000001,
  'metric-tonne': 1_000,
  pound: 0.45359237,
  ounce: 0.028349523125,
  stone: 6.35029318,
  'meter-per-second': 1,
  'kilometer-per-hour': 1 / 3.6,
  'mile-per-hour': 0.44704,
  knot: 0.5144444444444445,
  'foot-per-second': 0.3048,
  second: 1,
  millisecond: 0.001,
  minute: 60,
  hour: 3_600,
  day: 86_400,
  week: 604_800,
  bit: 0.125,
  byte: 1,
  kilobyte: 1_000,
  megabyte: 1_000_000,
  gigabyte: 1_000_000_000,
  terabyte: 1_000_000_000_000,
  kibibyte: 1_024,
  mebibyte: 1_048_576,
  gibibyte: 1_073_741_824,
  tebibyte: 1_099_511_627_776,
}

describe('unit converter', () => {
  it('uses the declared canonical factor for every linear unit formula', () => {
    const formulaUnitIds = new Set([
      'kelvin',
      'celsius',
      'fahrenheit',
      'liter-per-100-kilometers',
      'kilometer-per-liter',
      'mile-per-us-gallon',
      'mile-per-imperial-gallon',
    ])
    const linearUnits = units.filter((unit) => !formulaUnitIds.has(unit.id))

    expect(Object.keys(linearBaseFactors).sort()).toEqual(linearUnits.map((unit) => unit.id).sort())

    for (const unit of linearUnits) {
      const factor = linearBaseFactors[unit.id]
      expect(unit.toBase(1)).toBe(factor)
      expect(unit.fromBase(factor)).toBe(1)
    }
  })

  it.each([
    ['length', 1, 'mile', 'meter', 1_609.344],
    ['area', 1, 'acre', 'square-meter', 4_046.8564224],
    ['volume', 1, 'us-gallon', 'liter', 3.785411784],
    ['mass', 1, 'pound', 'kilogram', 0.45359237],
    ['temperature', 32, 'fahrenheit', 'celsius', 0],
    ['speed', 60, 'mile-per-hour', 'kilometer-per-hour', 96.56064],
    ['time', 2, 'day', 'hour', 48],
    ['digital storage', 1, 'mebibyte', 'byte', 1_048_576],
    ['fuel consumption', 7.5, 'liter-per-100-kilometers', 'mile-per-us-gallon', 31.36194444444444],
  ])('converts a known %s vector', (_category, value, fromId, toId, expected) => {
    expect(convert(value, fromId, toId)).toBeCloseTo(expected, 9)
  })

  it.each([
    [0, 'celsius', 'kelvin', 273.15],
    [100, 'celsius', 'fahrenheit', 212],
    [-40, 'celsius', 'fahrenheit', -40],
    [32, 'fahrenheit', 'kelvin', 273.15],
    [273.15, 'kelvin', 'celsius', 0],
  ])('applies affine temperature formulas', (value, fromId, toId, expected) => {
    expect(convert(value, fromId, toId)).toBeCloseTo(expected, 10)
  })

  it.each([
    [5, 'liter-per-100-kilometers', 'kilometer-per-liter', 20],
    [20, 'kilometer-per-liter', 'liter-per-100-kilometers', 5],
    [5, 'liter-per-100-kilometers', 'mile-per-us-gallon', 47.04291666666666],
    [47.04291666666666, 'mile-per-us-gallon', 'liter-per-100-kilometers', 5],
    [5, 'liter-per-100-kilometers', 'mile-per-imperial-gallon', 56.49618726636444],
    [56.49618726636444, 'mile-per-imperial-gallon', 'liter-per-100-kilometers', 5],
  ])('applies reciprocal fuel-consumption formulas', (value, fromId, toId, expected) => {
    expect(convert(value, fromId, toId)).toBeCloseTo(expected, 9)
  })

  it('round-trips every registered unit through its category base unit', () => {
    for (const category of conversionRegistry) {
      const sample = category.id === 'fuel-consumption' ? 7.25 : 123.456

      for (const unit of category.units) {
        const baseValue = convert(sample, unit.id, category.baseUnitId)
        const roundTrip = convert(baseValue, category.baseUnitId, unit.id)
        expect(roundTrip).toBeCloseTo(sample, 10)
      }
    }
  })

  it('returns the exact value for a same-unit conversion', () => {
    expect(convert(-0, 'meter', 'meter')).toBe(-0)
    expect(convert(12.5, 'celsius', 'celsius')).toBe(12.5)
    expect(convert(0, 'mile-per-us-gallon', 'mile-per-us-gallon')).toBe(0)
  })

  it('supports swapping while preserving compatible unit IDs', () => {
    expect(swapUnits('meter', 'foot')).toEqual({
      fromUnitId: 'foot',
      toUnitId: 'meter',
    })
    expect(convertAndSwap(1, 'meter', 'centimeter')).toEqual({
      value: 100,
      fromUnitId: 'centimeter',
      toUnitId: 'meter',
    })
  })

  it.each([NaN, Infinity, -Infinity, '12', null, undefined])(
    'rejects the non-finite numeric input %s',
    (value) => {
      expectConversionError(() => convert(value, 'meter', 'foot'), 'INVALID_VALUE')
    },
  )

  it('rejects unknown and incompatible units', () => {
    expectConversionError(() => convert(1, 'unknown', 'meter'), 'UNKNOWN_UNIT')
    expectConversionError(() => convert(1, 'meter', ''), 'UNKNOWN_UNIT')
    expectConversionError(() => convert(1, 'meter', 'liter'), 'INCOMPATIBLE_UNITS')
    expectConversionError(() => swapUnits('meter', 'second'), 'INCOMPATIBLE_UNITS')
    expect(getUnit('meter')).toBeTruthy()
  })

  it('rejects conversions whose formula has no finite result', () => {
    expectConversionError(
      () => convert(0, 'liter-per-100-kilometers', 'kilometer-per-liter'),
      'UNDEFINED_CONVERSION',
    )
    expectConversionError(
      () => convert(Number.MAX_VALUE, 'kilometer', 'meter'),
      'UNDEFINED_CONVERSION',
    )
  })
})

function expectConversionError(callback, code) {
  try {
    callback()
    throw new Error('Expected conversion to fail.')
  } catch (error) {
    expect(error).toBeInstanceOf(UnitConversionError)
    expect(error.code).toBe(code)
  }
}
