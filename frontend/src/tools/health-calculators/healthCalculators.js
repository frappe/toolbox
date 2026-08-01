import { HealthCalculationError } from './errors'

const POUNDS_PER_KILOGRAM = 2.2046226218
const INCHES_PER_METER = 39.37007874
const KILOMETERS_PER_MILE = 1.609344

export const activityLevels = Object.freeze([
  { value: '1.2', label: 'Sedentary', detail: 'Little or no planned exercise' },
  { value: '1.375', label: 'Lightly active', detail: 'Light exercise 1–3 days each week' },
  { value: '1.55', label: 'Moderately active', detail: 'Moderate exercise 3–5 days each week' },
  { value: '1.725', label: 'Very active', detail: 'Hard exercise 6–7 days each week' },
  { value: '1.9', label: 'Extra active', detail: 'Very hard exercise or a physical job' },
])

export function calculateBmi({ unitSystem, height, weight }) {
  const { heightMeters, weightKilograms } = normalizeBodyMeasurements(unitSystem, height, weight)
  const bmi = weightKilograms / heightMeters ** 2
  return { bmi, category: getBmiCategory(bmi), heightMeters, weightKilograms }
}

export function calculateBmr({ unitSystem, height, weight, age, sex }) {
  const { heightMeters, weightKilograms } = normalizeBodyMeasurements(unitSystem, height, weight)
  const safeAge = requireRange(age, 'Age', 18, 120)
  if (!['male', 'female'].includes(sex)) throw new HealthCalculationError('Select the sex used by the formula.')
  const adjustment = sex === 'male' ? 5 : -161
  const bmr = 10 * weightKilograms + 6.25 * heightMeters * 100 - 5 * safeAge + adjustment
  if (bmr <= 0) throw new HealthCalculationError('These inputs do not produce a usable BMR estimate.')
  return { bmr, heightMeters, weightKilograms, age: safeAge, sex }
}

export function calculateMaintenance(values) {
  const bmrResult = calculateBmr(values)
  const multiplier = requireRange(values.activityMultiplier, 'Activity level', 1.2, 1.9)
  const activity = activityLevels.find((level) => Number(level.value) === multiplier)
  if (!activity) throw new HealthCalculationError('Select a listed activity level.')
  return { ...bmrResult, multiplier, activity, calories: bmrResult.bmr * multiplier }
}

export function calculatePace({ solveFor, distance, duration, pace, distanceUnit }) {
  if (!['distance', 'duration', 'pace'].includes(solveFor)) throw new HealthCalculationError('Select the value to calculate.')
  if (!['km', 'mi'].includes(distanceUnit)) throw new HealthCalculationError('Select kilometres or miles.')
  const parsed = {
    distance: solveFor === 'distance' ? null : requireRange(distance, 'Distance', 0.001, 100000),
    duration: solveFor === 'duration' ? null : parseClockDuration(duration, 'Duration'),
    pace: solveFor === 'pace' ? null : parseClockDuration(pace, 'Pace'),
  }
  if (solveFor === 'distance') parsed.distance = parsed.duration / parsed.pace
  if (solveFor === 'duration') parsed.duration = parsed.distance * parsed.pace
  if (solveFor === 'pace') parsed.pace = parsed.duration / parsed.distance
  if (![parsed.distance, parsed.duration, parsed.pace].every(Number.isFinite)) throw new HealthCalculationError('The result is outside the supported range.')
  if (parsed.duration > 31_536_000 || parsed.pace > 86_400 || parsed.distance > 100000) throw new HealthCalculationError('The result is outside the supported range.')
  const distanceKilometers = distanceUnit === 'km' ? parsed.distance : parsed.distance * KILOMETERS_PER_MILE
  return { ...parsed, distanceKilometers, distanceUnit, speed: parsed.distance / (parsed.duration / 3600) }
}

export function getBmiCategory(bmi) {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Healthy weight'
  if (bmi < 30) return 'Overweight'
  if (bmi < 35) return 'Class 1 obesity'
  if (bmi < 40) return 'Class 2 obesity'
  return 'Class 3 obesity'
}

export function parseClockDuration(value, label = 'Duration') {
  const text = String(value ?? '').trim()
  if (!/^\d{1,4}:\d{2}(?::\d{2})?$/.test(text)) throw new HealthCalculationError(`${label} must use MM:SS or HH:MM:SS.`)
  const parts = text.split(':').map(Number)
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, ...parts]
  if (minutes > 59 || seconds > 59) throw new HealthCalculationError(`${label} minutes and seconds must be below 60.`)
  const totalSeconds = hours * 3600 + minutes * 60 + seconds
  if (totalSeconds <= 0) throw new HealthCalculationError(`${label} must be greater than zero.`)
  return totalSeconds
}

export function formatClockDuration(totalSeconds) {
  const rounded = Math.round(totalSeconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const seconds = rounded % 60
  const base = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours ? `${hours}:${base}` : base
}

function normalizeBodyMeasurements(unitSystem, height, weight) {
  if (!['metric', 'imperial'].includes(unitSystem)) throw new HealthCalculationError('Select metric or imperial units.')
  const safeHeight = requireRange(height, 'Height', unitSystem === 'metric' ? 50 : 20, unitSystem === 'metric' ? 275 : 108)
  const safeWeight = requireRange(weight, 'Weight', unitSystem === 'metric' ? 15 : 33, unitSystem === 'metric' ? 500 : 1102)
  return {
    heightMeters: unitSystem === 'metric' ? safeHeight / 100 : safeHeight / INCHES_PER_METER,
    weightKilograms: unitSystem === 'metric' ? safeWeight : safeWeight / POUNDS_PER_KILOGRAM,
  }
}

function requireRange(value, label, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new HealthCalculationError(`${label} must be a number.`)
  if (number < minimum || number > maximum) throw new HealthCalculationError(`${label} must be between ${minimum} and ${maximum}.`)
  return number
}
