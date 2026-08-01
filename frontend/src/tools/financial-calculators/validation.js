import { FinancialCalculationError } from './errors'

export function requirePositive(value, label) {
  requireFinite(value, label)
  if (value <= 0) throw new FinancialCalculationError(`${label} must be greater than zero.`)
  return value
}

export function requireNonNegative(value, label) {
  requireFinite(value, label)
  if (value < 0) throw new FinancialCalculationError(`${label} cannot be negative.`)
  return value
}

export function requireWholePositive(value, label) {
  requirePositive(value, label)
  if (!Number.isInteger(value)) {
    throw new FinancialCalculationError(`${label} must be a whole number.`)
  }
  return value
}

export function requireAtMost(value, maximum, label) {
  if (value > maximum) {
    throw new FinancialCalculationError(`${label} cannot exceed ${maximum}.`)
  }
  return value
}

export function requireFiniteResult(value) {
  if (!Number.isFinite(value)) {
    throw new FinancialCalculationError('The inputs produce a value that is too large.')
  }
  return value
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) {
    throw new FinancialCalculationError(`${label} must be a valid number.`)
  }
}
