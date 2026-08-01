import { GstCalculationError } from './errors'

export const MIN_GST_RATE = 0
export const MAX_GST_RATE = 100
export const MAX_GST_RATE_DECIMAL_PLACES = 4

const RATE_SCALE = 10 ** MAX_GST_RATE_DECIMAL_PLACES
const RATE_TOLERANCE = 1e-10

const standardRateDefinitions = [
  { id: 'nil', rate: 0, label: '0%' },
  { id: 'quarter', rate: 0.25, label: '0.25%' },
  { id: 'three', rate: 3, label: '3%' },
  { id: 'five', rate: 5, label: '5%' },
  { id: 'twelve', rate: 12, label: '12%' },
  { id: 'eighteen', rate: 18, label: '18%' },
  { id: 'twenty-eight', rate: 28, label: '28%' },
]

export const STANDARD_GST_RATES = Object.freeze(
  standardRateDefinitions.map((entry) => Object.freeze({ ...entry })),
)

const standardRatesById = Object.freeze(
  Object.fromEntries(STANDARD_GST_RATES.map((entry) => [entry.id, entry])),
)

export function getStandardGstRate(rateId) {
  if (typeof rateId !== 'string') return undefined
  if (!Object.hasOwn(standardRatesById, rateId)) return undefined
  return standardRatesById[rateId]
}

export function isStandardGstRate(rate) {
  if (typeof rate !== 'number') return false
  return STANDARD_GST_RATES.some((entry) => entry.rate === rate)
}

export function validateCustomGstRate(rate) {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new GstCalculationError('INVALID_RATE', 'GST rate must be a finite number.')
  }
  if (rate < MIN_GST_RATE || rate > MAX_GST_RATE) {
    throw new GstCalculationError(
      'INVALID_RATE',
      `GST rate must be from ${MIN_GST_RATE}% to ${MAX_GST_RATE}%.`,
    )
  }

  const normalizedRate = Math.round(rate * RATE_SCALE) / RATE_SCALE
  if (Math.abs(normalizedRate - rate) > RATE_TOLERANCE) {
    throw new GstCalculationError(
      'INVALID_RATE',
      `GST rate can have at most ${MAX_GST_RATE_DECIMAL_PLACES} decimal places.`,
    )
  }
  return normalizedRate
}

export function parseGstRateHandoff(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return parseHandoffNumber(value)
  if (typeof value !== 'string') return null

  const match = value.trim().match(/^([0-9]+(?:\.[0-9]{1,4})?)\s*%?$/u)
  if (!match) return null
  return parseHandoffNumber(Number(match[1]))
}

function parseHandoffNumber(value) {
  try {
    return validateCustomGstRate(value)
  } catch (error) {
    if (error instanceof GstCalculationError) return null
    throw error
  }
}
