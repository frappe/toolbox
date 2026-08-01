export class CurrencyConversionError extends Error {}

export function convertCurrency(amount, sourceCurrency, destinationCurrency, rates) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 0 || value > 1e15) throw new CurrencyConversionError('Amount must be between 0 and 1,000,000,000,000,000.')
  const sourceRate = getRate(rates, sourceCurrency)
  const destinationRate = getRate(rates, destinationCurrency)
  return value * destinationRate / sourceRate
}

function getRate(rates, code) {
  const rate = rates?.[code]
  if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(rate) || rate <= 0) throw new CurrencyConversionError('The selected currency does not have a valid reference rate.')
  return rate
}
