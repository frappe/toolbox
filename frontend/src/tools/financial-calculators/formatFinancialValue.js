export function createFinancialFormatter(settings) {
  const locale = settings.numberFormat === 'indian' ? 'en-IN' : 'en-US'
  const precision = settings.decimalPrecision
  const numberFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: settings.defaultCurrency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })

  return (value, format) => {
    if (format === 'currency') return currencyFormatter.format(value)
    if (format === 'percent') return `${numberFormatter.format(value)}%`
    if (format === 'units') return `${new Intl.NumberFormat(locale).format(value)} units`
    if (format === 'number') return new Intl.NumberFormat(locale).format(value)
    return numberFormatter.format(value)
  }
}
