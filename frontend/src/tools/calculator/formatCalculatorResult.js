const SIGNIFICANT_DIGITS = 12
const SCIENTIFIC_UPPER_BOUND = 1e12
const SCIENTIFIC_LOWER_BOUND = 1e-9

export function formatCalculatorResult(value) {
  if (!Number.isFinite(value)) {
    throw new TypeError('Calculator results must be finite numbers.')
  }

  if (Object.is(value, -0) || value === 0) return '0'

  const absoluteValue = Math.abs(value)
  if (absoluteValue >= SCIENTIFIC_UPPER_BOUND || absoluteValue < SCIENTIFIC_LOWER_BOUND) {
    return formatScientific(value)
  }

  return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)))
}

function formatScientific(value) {
  const [mantissa, exponent] = value.toExponential(SIGNIFICANT_DIGITS - 1).split('e')
  const trimmedMantissa = mantissa.replace(/0+$/u, '').replace(/\.$/u, '')
  return `${trimmedMantissa}e${Number(exponent)}`
}
