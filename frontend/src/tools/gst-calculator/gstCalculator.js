import { GstCalculationError } from './errors'
import { MAX_GST_RATE_DECIMAL_PLACES, validateCustomGstRate } from './rates'

export const GST_MODES = Object.freeze({
  ADD: 'add',
  REMOVE: 'remove',
})

export const GST_SUPPLY_TYPES = Object.freeze({
  INTRA_STATE: 'intra-state',
  INTER_STATE: 'inter-state',
})

export const MAX_GST_AMOUNT = 1_000_000_000_000

const CURRENCY_SCALE = 100
const RATE_SCALE = 10 ** MAX_GST_RATE_DECIMAL_PLACES
const PERCENT_RATE_UNITS = 100 * RATE_SCALE

export function calculateGst(input) {
  assertInputObject(input)
  const mode = validateMode(input.mode)
  const supplyType = validateSupplyType(input.supplyType)
  const rate = validateCustomGstRate(input.rate)
  const amountMinor = toMinorUnits(input.amount)
  const rateUnits = BigInt(Math.round(rate * RATE_SCALE))

  const amounts =
    mode === GST_MODES.ADD ? addGst(amountMinor, rateUnits) : removeGst(amountMinor, rateUnits)
  const split = splitGst(amounts.totalGstMinor, supplyType)

  return Object.freeze({
    mode,
    supplyType,
    rate,
    inputAmount: fromMinorUnits(amountMinor),
    taxableValue: fromMinorUnits(amounts.taxableValueMinor),
    cgst: fromMinorUnits(split.cgstMinor),
    sgst: fromMinorUnits(split.sgstMinor),
    igst: fromMinorUnits(split.igstMinor),
    totalGst: fromMinorUnits(amounts.totalGstMinor),
    finalAmount: fromMinorUnits(amounts.inclusiveAmountMinor),
    inclusiveAmount: fromMinorUnits(amounts.inclusiveAmountMinor),
  })
}

export function roundCurrency(value) {
  return fromMinorUnits(toMinorUnits(value))
}

function addGst(taxableValueMinor, rateUnits) {
  const totalGstMinor = divideRounded(taxableValueMinor * rateUnits, BigInt(PERCENT_RATE_UNITS))
  return {
    taxableValueMinor,
    totalGstMinor,
    inclusiveAmountMinor: taxableValueMinor + totalGstMinor,
  }
}

function removeGst(inclusiveAmountMinor, rateUnits) {
  const percentUnits = BigInt(PERCENT_RATE_UNITS)
  const taxableValueMinor = divideRounded(
    inclusiveAmountMinor * percentUnits,
    percentUnits + rateUnits,
  )
  return {
    taxableValueMinor,
    totalGstMinor: inclusiveAmountMinor - taxableValueMinor,
    inclusiveAmountMinor,
  }
}

function splitGst(totalGstMinor, supplyType) {
  if (supplyType === GST_SUPPLY_TYPES.INTER_STATE) {
    return { cgstMinor: 0n, sgstMinor: 0n, igstMinor: totalGstMinor }
  }

  const cgstMinor = totalGstMinor / 2n
  return {
    cgstMinor,
    sgstMinor: totalGstMinor - cgstMinor,
    igstMinor: 0n,
  }
}

function divideRounded(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator
}

function toMinorUnits(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new GstCalculationError('INVALID_AMOUNT', 'Amount must be a finite number.')
  }
  if (amount < 0 || amount > MAX_GST_AMOUNT) {
    throw new GstCalculationError('INVALID_AMOUNT', `Amount must be from 0 to ${MAX_GST_AMOUNT}.`)
  }

  const roundingAdjustment = Number.EPSILON * Math.max(1, amount)
  const minorUnits = Math.round((amount + roundingAdjustment) * CURRENCY_SCALE)
  if (!Number.isSafeInteger(minorUnits)) {
    throw new GstCalculationError('INVALID_AMOUNT', 'Amount is outside the supported range.')
  }
  return BigInt(minorUnits)
}

function fromMinorUnits(amount) {
  const numericAmount = Number(amount)
  if (!Number.isSafeInteger(numericAmount)) {
    throw new GstCalculationError('NUMERIC_RANGE', 'GST result is outside the supported range.')
  }
  return numericAmount / CURRENCY_SCALE
}

function assertInputObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new GstCalculationError('INVALID_INPUT', 'GST calculation input must be an object.')
  }
}

function validateMode(mode) {
  if (!Object.values(GST_MODES).includes(mode)) {
    throw new GstCalculationError('INVALID_MODE', 'GST mode must be add or remove.')
  }
  return mode
}

function validateSupplyType(supplyType) {
  if (!Object.values(GST_SUPPLY_TYPES).includes(supplyType)) {
    throw new GstCalculationError(
      'INVALID_SUPPLY_TYPE',
      'GST supply type must be intra-state or inter-state.',
    )
  }
  return supplyType
}
