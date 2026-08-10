// The forecast is Celsius on the wire and stays that way, so one cached copy on the server serves
// every visitor whatever unit they read in. The unit a visitor chose is applied here, where the
// number is shown.

export const TEMPERATURE_SYMBOLS = { celsius: '°C', fahrenheit: '°F' }

export function convertTemperature(celsius, unit) {
  if (!Number.isFinite(celsius)) return null
  return unit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius
}

export function formatTemperature(celsius, unit) {
  const value = convertTemperature(celsius, unit)
  if (value === null) return '—'
  // A forecast is never worth a decimal place. Rounding after the conversion keeps 37 °C at 99 °F
  // rather than at the 98 a rounded Celsius would give.
  return `${Math.round(value)}${TEMPERATURE_SYMBOLS[unit] ?? TEMPERATURE_SYMBOLS.celsius}`
}
