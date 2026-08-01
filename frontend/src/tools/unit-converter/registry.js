import {
  fuelConsumptionConversions,
  linearConversion,
  temperatureConversions,
} from './conversions'

const categoryDefinitions = [
  {
    id: 'length',
    name: 'Length',
    baseUnitId: 'meter',
    units: [
      unit('meter', 'Meter', 'm', 'length', ['meters', 'metre', 'metres'], 1),
      unit('kilometer', 'Kilometer', 'km', 'length', ['kilometers', 'kilometre', 'kilometres'], 1_000),
      unit('centimeter', 'Centimeter', 'cm', 'length', ['centimeters', 'centimetre', 'centimetres'], 0.01),
      unit('millimeter', 'Millimeter', 'mm', 'length', ['millimeters', 'millimetre', 'millimetres'], 0.001),
      unit('inch', 'Inch', 'in', 'length', ['inches'], 0.0254),
      unit('foot', 'Foot', 'ft', 'length', ['feet'], 0.3048),
      unit('yard', 'Yard', 'yd', 'length', ['yards'], 0.9144),
      unit('mile', 'Mile', 'mi', 'length', ['miles'], 1_609.344),
      unit('nautical-mile', 'Nautical mile', 'nmi', 'length', ['nautical miles', 'NM'], 1_852),
    ],
  },
  {
    id: 'area',
    name: 'Area',
    baseUnitId: 'square-meter',
    units: [
      unit('square-meter', 'Square meter', 'm²', 'area', ['square meters', 'square metre', 'm2', 'sqm'], 1),
      unit('square-kilometer', 'Square kilometer', 'km²', 'area', ['square kilometers', 'square kilometre', 'km2', 'sq km'], 1_000_000),
      unit('square-centimeter', 'Square centimeter', 'cm²', 'area', ['square centimeters', 'square centimetre', 'cm2', 'sq cm'], 0.0001),
      unit('square-millimeter', 'Square millimeter', 'mm²', 'area', ['square millimeters', 'square millimetre', 'mm2', 'sq mm'], 0.000001),
      unit('hectare', 'Hectare', 'ha', 'area', ['hectares'], 10_000),
      unit('acre', 'Acre', 'ac', 'area', ['acres'], 4_046.8564224),
      unit('square-foot', 'Square foot', 'ft²', 'area', ['square feet', 'ft2', 'sq ft'], 0.09290304),
      unit('square-yard', 'Square yard', 'yd²', 'area', ['square yards', 'yd2', 'sq yd'], 0.83612736),
      unit('square-mile', 'Square mile', 'mi²', 'area', ['square miles', 'mi2', 'sq mi'], 2_589_988.110336),
    ],
  },
  {
    id: 'volume',
    name: 'Volume',
    baseUnitId: 'liter',
    units: [
      unit('liter', 'Liter', 'L', 'volume', ['liters', 'litre', 'litres'], 1),
      unit('milliliter', 'Milliliter', 'mL', 'volume', ['milliliters', 'millilitre', 'millilitres'], 0.001),
      unit('cubic-meter', 'Cubic meter', 'm³', 'volume', ['cubic meters', 'cubic metre', 'm3'], 1_000),
      unit('cubic-centimeter', 'Cubic centimeter', 'cm³', 'volume', ['cubic centimeters', 'cubic centimetre', 'cm3', 'cc'], 0.001),
      unit('cubic-inch', 'Cubic inch', 'in³', 'volume', ['cubic inches', 'in3', 'cu in'], 0.016387064),
      unit('cubic-foot', 'Cubic foot', 'ft³', 'volume', ['cubic feet', 'ft3', 'cu ft'], 28.316846592),
      unit('us-gallon', 'US gallon', 'gal (US)', 'volume', ['US gallons', 'gallon US', 'gal us'], 3.785411784),
      unit('imperial-gallon', 'Imperial gallon', 'gal (Imp)', 'volume', ['imperial gallons', 'UK gallon', 'gal imp'], 4.54609),
      unit('us-fluid-ounce', 'US fluid ounce', 'fl oz (US)', 'volume', ['US fluid ounces', 'fluid ounce US', 'fl oz us'], 0.0295735295625),
    ],
  },
  {
    id: 'mass',
    name: 'Weight and mass',
    baseUnitId: 'kilogram',
    units: [
      unit('kilogram', 'Kilogram', 'kg', 'mass', ['kilograms', 'kilo', 'kilos'], 1),
      unit('gram', 'Gram', 'g', 'mass', ['grams'], 0.001),
      unit('milligram', 'Milligram', 'mg', 'mass', ['milligrams'], 0.000001),
      unit('metric-tonne', 'Metric tonne', 't', 'mass', ['metric tonnes', 'metric ton', 'tonne', 'tonnes'], 1_000),
      unit('pound', 'Pound', 'lb', 'mass', ['pounds', 'lbs'], 0.45359237),
      unit('ounce', 'Ounce', 'oz', 'mass', ['ounces'], 0.028349523125),
      unit('stone', 'Stone', 'st', 'mass', ['stones'], 6.35029318),
    ],
  },
  {
    id: 'temperature',
    name: 'Temperature',
    baseUnitId: 'kelvin',
    units: [
      formulaUnit('kelvin', 'Kelvin', 'K', 'temperature', ['kelvins'], temperatureConversions.kelvin),
      formulaUnit('celsius', 'Celsius', '°C', 'temperature', ['degrees Celsius', 'degree Celsius', 'C', 'centigrade'], temperatureConversions.celsius),
      formulaUnit('fahrenheit', 'Fahrenheit', '°F', 'temperature', ['degrees Fahrenheit', 'degree Fahrenheit', 'F'], temperatureConversions.fahrenheit),
    ],
  },
  {
    id: 'speed',
    name: 'Speed',
    baseUnitId: 'meter-per-second',
    units: [
      unit('meter-per-second', 'Meter per second', 'm/s', 'speed', ['meters per second', 'metre per second', 'mps'], 1),
      unit('kilometer-per-hour', 'Kilometer per hour', 'km/h', 'speed', ['kilometers per hour', 'kilometres per hour', 'kph', 'kmph'], 1 / 3.6),
      unit('mile-per-hour', 'Mile per hour', 'mph', 'speed', ['miles per hour', 'mi/h'], 0.44704),
      unit('knot', 'Knot', 'kn', 'speed', ['knots', 'nautical miles per hour', 'kt'], 0.5144444444444445),
      unit('foot-per-second', 'Foot per second', 'ft/s', 'speed', ['feet per second', 'fps'], 0.3048),
    ],
  },
  {
    id: 'time',
    name: 'Time',
    baseUnitId: 'second',
    units: [
      unit('second', 'Second', 's', 'time', ['seconds', 'sec'], 1),
      unit('millisecond', 'Millisecond', 'ms', 'time', ['milliseconds', 'msec'], 0.001),
      unit('minute', 'Minute', 'min', 'time', ['minutes', 'mins'], 60),
      unit('hour', 'Hour', 'h', 'time', ['hours', 'hr', 'hrs'], 3_600),
      unit('day', 'Day', 'd', 'time', ['days'], 86_400),
      unit('week', 'Week', 'wk', 'time', ['weeks', 'wks'], 604_800),
    ],
  },
  {
    id: 'digital-storage',
    name: 'Digital storage',
    baseUnitId: 'byte',
    units: [
      unit('bit', 'Bit', 'b', 'digital-storage', ['bits', 'bit'], 0.125),
      unit('byte', 'Byte', 'B', 'digital-storage', ['bytes'], 1),
      unit('kilobyte', 'Kilobyte', 'kB', 'digital-storage', ['kilobytes', 'KB'], 1_000),
      unit('megabyte', 'Megabyte', 'MB', 'digital-storage', ['megabytes'], 1_000_000),
      unit('gigabyte', 'Gigabyte', 'GB', 'digital-storage', ['gigabytes'], 1_000_000_000),
      unit('terabyte', 'Terabyte', 'TB', 'digital-storage', ['terabytes'], 1_000_000_000_000),
      unit('kibibyte', 'Kibibyte', 'KiB', 'digital-storage', ['kibibytes'], 1_024),
      unit('mebibyte', 'Mebibyte', 'MiB', 'digital-storage', ['mebibytes'], 1_048_576),
      unit('gibibyte', 'Gibibyte', 'GiB', 'digital-storage', ['gibibytes'], 1_073_741_824),
      unit('tebibyte', 'Tebibyte', 'TiB', 'digital-storage', ['tebibytes'], 1_099_511_627_776),
    ],
  },
  {
    id: 'fuel-consumption',
    name: 'Fuel consumption',
    baseUnitId: 'liter-per-100-kilometers',
    units: [
      formulaUnit('liter-per-100-kilometers', 'Liter per 100 kilometers', 'L/100 km', 'fuel-consumption', ['liters per 100 kilometers', 'litres per 100 kilometres', 'l/100km'], fuelConsumptionConversions.litersPer100Kilometers),
      formulaUnit('kilometer-per-liter', 'Kilometer per liter', 'km/L', 'fuel-consumption', ['kilometers per liter', 'kilometres per litre', 'kmpl'], fuelConsumptionConversions.kilometersPerLiter),
      formulaUnit('mile-per-us-gallon', 'Mile per US gallon', 'mpg (US)', 'fuel-consumption', ['miles per US gallon', 'US mpg', 'mpg us'], fuelConsumptionConversions.milesPerUsGallon),
      formulaUnit('mile-per-imperial-gallon', 'Mile per Imperial gallon', 'mpg (Imp)', 'fuel-consumption', ['miles per imperial gallon', 'UK mpg', 'mpg imp'], fuelConsumptionConversions.milesPerImperialGallon),
    ],
  },
]

export const conversionRegistry = deepFreeze(categoryDefinitions)
export const categoriesById = frozenRecord(conversionRegistry.map((category) => [category.id, category]))
export const units = Object.freeze(conversionRegistry.flatMap((category) => category.units))
export const unitsById = frozenRecord(units.map((entry) => [entry.id, entry]))

export function getCategory(categoryId) {
  return categoriesById[categoryId]
}

export function getUnit(unitId) {
  return unitsById[unitId]
}

export function getUnitsByCategory(categoryId) {
  return getCategory(categoryId)?.units ?? Object.freeze([])
}

function unit(id, name, symbol, category, aliases, factor) {
  return formulaUnit(id, name, symbol, category, aliases, linearConversion(factor))
}

function formulaUnit(id, name, symbol, category, aliases, conversion) {
  return {
    id,
    name,
    symbol,
    category,
    aliases,
    toBase: conversion.toBase,
    fromBase: conversion.fromBase,
  }
}

function frozenRecord(entries) {
  return Object.freeze(Object.fromEntries(entries))
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  for (const child of Object.values(value)) {
    deepFreeze(child)
  }

  return Object.freeze(value)
}
