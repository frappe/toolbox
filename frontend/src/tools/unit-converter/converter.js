import { getUnit } from './registry'

export class UnitConversionError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'UnitConversionError'
    this.code = code
  }
}

export function convert(value, fromUnitId, toUnitId) {
  assertFiniteNumber(value)
  const [fromUnit, toUnit] = getCompatibleUnits(fromUnitId, toUnitId)

  if (fromUnit === toUnit) {
    return value
  }

  const baseValue = fromUnit.toBase(value)
  const result = toUnit.fromBase(baseValue)
  assertFiniteResult(baseValue, result)

  return result
}

export function swapUnits(fromUnitId, toUnitId) {
  const [fromUnit, toUnit] = getCompatibleUnits(fromUnitId, toUnitId)

  return Object.freeze({
    fromUnitId: toUnit.id,
    toUnitId: fromUnit.id,
  })
}

export function convertAndSwap(value, fromUnitId, toUnitId) {
  const convertedValue = convert(value, fromUnitId, toUnitId)
  const swappedUnits = swapUnits(fromUnitId, toUnitId)

  return Object.freeze({ value: convertedValue, ...swappedUnits })
}

function getCompatibleUnits(fromUnitId, toUnitId) {
  const fromUnit = requireUnit(fromUnitId, 'source')
  const toUnit = requireUnit(toUnitId, 'destination')

  if (fromUnit.category !== toUnit.category) {
    throw new UnitConversionError(
      'INCOMPATIBLE_UNITS',
      `Cannot convert ${fromUnit.name} to ${toUnit.name}.`,
    )
  }

  return [fromUnit, toUnit]
}

function requireUnit(unitId, role) {
  if (typeof unitId !== 'string' || !unitId.trim()) {
    throw new UnitConversionError('UNKNOWN_UNIT', `A valid ${role} unit ID is required.`)
  }

  const unit = getUnit(unitId)
  if (!unit) {
    throw new UnitConversionError('UNKNOWN_UNIT', `Unknown ${role} unit: ${unitId}.`)
  }

  return unit
}

function assertFiniteNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new UnitConversionError('INVALID_VALUE', 'Value must be a finite number.')
  }
}

function assertFiniteResult(baseValue, result) {
  if (!Number.isFinite(baseValue) || !Number.isFinite(result)) {
    throw new UnitConversionError(
      'UNDEFINED_CONVERSION',
      'The conversion is undefined for the supplied value.',
    )
  }
}
