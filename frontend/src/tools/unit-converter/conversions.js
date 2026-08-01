export function linearConversion(factor) {
  return Object.freeze({
    toBase: (value) => value * factor,
    fromBase: (value) => value / factor,
  })
}

export const temperatureConversions = Object.freeze({
  kelvin: Object.freeze({
    toBase: (value) => value,
    fromBase: (value) => value,
  }),
  celsius: Object.freeze({
    toBase: (value) => value + 273.15,
    fromBase: (value) => value - 273.15,
  }),
  fahrenheit: Object.freeze({
    toBase: (value) => ((value - 32) * 5) / 9 + 273.15,
    fromBase: (value) => ((value - 273.15) * 9) / 5 + 32,
  }),
})

export const fuelConsumptionConversions = Object.freeze({
  litersPer100Kilometers: Object.freeze({
    toBase: (value) => value,
    fromBase: (value) => value,
  }),
  kilometersPerLiter: Object.freeze({
    toBase: (value) => 100 / value,
    fromBase: (value) => 100 / value,
  }),
  milesPerUsGallon: Object.freeze({
    toBase: (value) => 235.2145833333333 / value,
    fromBase: (value) => 235.2145833333333 / value,
  }),
  milesPerImperialGallon: Object.freeze({
    toBase: (value) => 282.4809363318222 / value,
    fromBase: (value) => 282.4809363318222 / value,
  }),
})
