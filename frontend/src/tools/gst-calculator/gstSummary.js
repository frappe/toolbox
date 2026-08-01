import { GstCalculationError } from './errors'
import { GST_MODES, GST_SUPPLY_TYPES } from './gstCalculator'
import { validateCustomGstRate } from './rates'

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/u
const CURRENCY_SCALE = 100
const MONETARY_FIELDS = Object.freeze([
  'taxableValue',
  'cgst',
  'sgst',
  'igst',
  'totalGst',
  'inclusiveAmount',
])

export function createGstCopySummary(result, { currencyCode = 'INR' } = {}) {
  validateResult(result)
  if (typeof currencyCode !== 'string' || !CURRENCY_CODE_PATTERN.test(currencyCode)) {
    throw new GstCalculationError(
      'INVALID_CURRENCY_CODE',
      'Currency code must contain exactly three uppercase letters.',
    )
  }

  const fields = [
    field('Mode', result.mode === GST_MODES.ADD ? 'Add GST' : 'Remove GST'),
    field(
      'Supply',
      result.supplyType === GST_SUPPLY_TYPES.INTRA_STATE ? 'Intra-state' : 'Inter-state',
    ),
    field('GST rate', `${result.rate}%`),
    moneyField('Taxable value', result.taxableValue, currencyCode),
    moneyField('CGST', result.cgst, currencyCode),
    moneyField('SGST', result.sgst, currencyCode),
    moneyField('IGST', result.igst, currencyCode),
    moneyField('Total GST', result.totalGst, currencyCode),
    moneyField(
      result.mode === GST_MODES.ADD ? 'Final amount' : 'Inclusive amount',
      result.inclusiveAmount,
      currencyCode,
    ),
  ]

  return Object.freeze({
    title: 'GST calculation',
    fields: Object.freeze(fields),
  })
}

export function formatGstCopySummary(summary) {
  if (!summary || typeof summary.title !== 'string' || !Array.isArray(summary.fields)) {
    throw new GstCalculationError('INVALID_SUMMARY', 'GST summary is not valid.')
  }
  return [summary.title, ...summary.fields.map((entry) => `${entry.label}: ${entry.value}`)].join(
    '\n',
  )
}

function field(label, value) {
  return Object.freeze({ label, value })
}

function moneyField(label, value, currencyCode) {
  return field(label, `${currencyCode} ${value.toFixed(2)}`)
}

function validateResult(result) {
  if (
    !result ||
    !Object.values(GST_MODES).includes(result.mode) ||
    !Object.values(GST_SUPPLY_TYPES).includes(result.supplyType) ||
    !isValidRate(result.rate)
  ) {
    throwInvalidResult()
  }

  const amounts = getMinorAmounts(result)
  const componentTotal = amounts.cgst + amounts.sgst + amounts.igst
  if (
    componentTotal !== amounts.totalGst ||
    amounts.taxableValue + amounts.totalGst !== amounts.inclusiveAmount ||
    !hasValidSupplySplit(result.supplyType, amounts)
  ) {
    throwInvalidResult()
  }
}

function isValidRate(rate) {
  try {
    validateCustomGstRate(rate)
    return true
  } catch (error) {
    if (error instanceof GstCalculationError) return false
    throw error
  }
}

function getMinorAmounts(result) {
  const amounts = {}
  for (const key of MONETARY_FIELDS) {
    const value = result[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throwInvalidResult()
    }

    const minorUnits = Math.round(value * CURRENCY_SCALE)
    if (!Number.isSafeInteger(minorUnits)) throwInvalidResult()
    amounts[key] = minorUnits
  }
  return amounts
}

function hasValidSupplySplit(supplyType, amounts) {
  if (supplyType === GST_SUPPLY_TYPES.INTER_STATE) {
    return amounts.cgst === 0 && amounts.sgst === 0
  }
  return amounts.igst === 0 && Math.abs(amounts.cgst - amounts.sgst) <= 1
}

function throwInvalidResult() {
  throw new GstCalculationError('INVALID_RESULT', 'GST calculation result is not valid.')
}
