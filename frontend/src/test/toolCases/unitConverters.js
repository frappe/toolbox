// Nine measurements, one view. Every factor below is the defining value rather than the one the
// application stores: a mile is exactly 1609.344 m, a pound exactly 0.45359237 kg, an acre exactly
// 4046.8564224 m². So a mistyped constant in the registry fails here.
//
// The result is an input rather than a text node, and the tool shows about ten decimal places. The
// assertions match the leading digits, which catches wrong arithmetic while leaving the display
// precision free to change.
const converter = (toolId, route, cases) => ({ toolId, route, cases })

const convert = (name, from, to, value, is) => ({
  name,
  fill: [
    { unit: 'From unit', pick: from },
    { unit: 'To unit', pick: to },
    { label: 'From value', value },
  ],
  expect: { value: { label: 'To value', is } },
})

export const unitConverterCases = [
  converter('length-converter', '/length-converter', [
    // 5 × 1609.344 m = 8046.72 m = 8.04672 km
    convert('five miles in kilometers', 'Mile', 'Kilometer', '5', /^8\.04672/),
    convert('a nautical mile is 1852 metres exactly', 'Nautical mile', 'Meter', '1', /^1852\b/),
    {
      name: 'a value that is not a number is refused',
      fill: [{ label: 'From value', value: 'abc' }],
      expect: { alert: /number/i },
    },
  ]),
  converter('weight-converter', '/weight-converter', [
    // 150 × 0.45359237 = 68.0388555
    convert('150 pounds in kilograms', 'Pound', 'Kilogram', '150', /^68\.0388555/),
    convert('a stone is 14 pounds', 'Stone', 'Pound', '1', /^14\b/),
  ]),
  converter('temperature-converter', '/temperature-converter', [
    convert('body temperature in Fahrenheit', 'Celsius', 'Fahrenheit', '37', /^98\.6/),
    convert('absolute zero in Celsius', 'Kelvin', 'Celsius', '0', /^-273\.15/),
    convert('the scales meet at minus forty', 'Celsius', 'Fahrenheit', '-40', /^-40/),
  ]),
  converter('volume-converter', '/volume-converter', [
    // 3 × 3.785411784 = 11.356235352
    convert('three US gallons in liters', 'US gallon', 'Liter', '3', /^11\.356235352/),
    convert('an imperial gallon is larger', 'Imperial gallon', 'Liter', '1', /^4\.54609/),
  ]),
  converter('area-converter', '/area-converter', [
    // 2 × 4046.8564224 = 8093.7128448
    convert('two acres in square meters', 'Acre', 'Square meter', '2', /^8093\.7128448/),
    convert('a hectare is ten thousand square metres', 'Hectare', 'Square meter', '1', /^10000\b/),
  ]),
  converter('speed-converter', '/speed-converter', [
    // 100 / 1.609344 = 62.1371192237
    convert('a hundred kilometers per hour in mph', 'Kilometer per hour', 'Mile per hour', '100', /^62\.137119/),
    convert('a knot is 1.852 km/h', 'Knot', 'Kilometer per hour', '1', /^1\.852/),
  ]),
  converter('time-unit-converter', '/time-unit-converter', [
    convert('a week in hours', 'Week', 'Hour', '1', /^168\b/),
    convert('ninety minutes in seconds', 'Minute', 'Second', '90', /^5400\b/),
  ]),
  converter('data-storage-converter', '/data-storage-converter', [
    // The decimal and binary prefixes are different units, which is the point of this case.
    convert('a gibibyte is more than a gigabyte', 'Gibibyte', 'Gigabyte', '1', /^1\.073741824/),
    convert('a megabyte in kilobytes', 'Megabyte', 'Kilobyte', '1', /^1000\b/),
    convert('a byte is eight bits', 'Byte', 'Bit', '1', /^8\b/),
  ]),
  converter('fuel-consumption-converter', '/fuel-consumption-converter', [
    // 235.2145833333333 / 8. The conversion is reciprocal, so the two scales run opposite ways.
    convert('eight liters per 100 km in US mpg', 'Liter per 100 kilometers', 'Mile per US gallon', '8', /^29\.40182/),
    convert('twenty km per liter in liters per 100 km', 'Kilometer per liter', 'Liter per 100 kilometers', '20', /^5\b/),
  ]),
]
