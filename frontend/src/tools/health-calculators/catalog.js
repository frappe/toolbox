import { activityLevels, calculateBmi, calculateBmr, calculateMaintenance, calculatePace, formatClockDuration } from './healthCalculators'

const unitOptions = [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }]
const sexOptions = [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }]
const distanceUnitOptions = [{ label: 'Kilometres', value: 'km' }, { label: 'Miles', value: 'mi' }]
const solveOptions = [{ label: 'Pace', value: 'pace' }, { label: 'Duration', value: 'duration' }, { label: 'Distance', value: 'distance' }]

export const healthCalculators = Object.freeze([
  defineCalculator({
    id: 'bmi', shortName: 'BMI', name: 'Body mass index',
    description: 'Estimate adult BMI and its standard screening category.',
    defaults: bodyDefaults(), inputs: bodyInputs,
    calculate: calculateBmi,
    present: (result) => ({
      primary: { label: 'Estimated BMI', value: result.bmi.toFixed(1) },
      rows: [{ label: 'Adult category', value: result.category }],
      formula: 'BMI = weight in kilograms ÷ height in metres squared.',
      assumption: 'Adult CDC categories apply. BMI is a screening measure and does not measure body composition.',
    }),
  }),
  defineCalculator({
    id: 'bmr', shortName: 'BMR', name: 'Basal metabolic rate',
    description: 'Estimate resting energy needs with the Mifflin–St Jeor equation.',
    defaults: { ...bodyDefaults(), age: '30', sex: 'male' }, inputs: metabolicInputs,
    calculate: calculateBmr,
    present: (result) => ({
      primary: { label: 'Estimated BMR', value: `${Math.round(result.bmr).toLocaleString()} kcal/day` },
      rows: [{ label: 'Formula', value: 'Mifflin–St Jeor' }],
      formula: `BMR = 10 × weight (kg) + 6.25 × height (cm) − 5 × age ${result.sex === 'male' ? '+ 5' : '− 161'}.`,
      assumption: 'The equation estimates resting energy expenditure for adults. Measured needs can differ.',
    }),
  }),
  defineCalculator({
    id: 'maintenance', shortName: 'Calories', name: 'Daily maintenance calories',
    description: 'Apply an explicit activity factor to the BMR estimate.',
    defaults: { ...bodyDefaults(), age: '30', sex: 'male', activityMultiplier: '1.55' }, inputs: maintenanceInputs,
    calculate: calculateMaintenance,
    present: (result) => ({
      primary: { label: 'Estimated maintenance', value: `${Math.round(result.calories).toLocaleString()} kcal/day` },
      rows: [{ label: 'Estimated BMR', value: `${Math.round(result.bmr).toLocaleString()} kcal/day` }, { label: 'Activity assumption', value: `${result.activity.label} × ${result.multiplier}` }],
      formula: 'Estimated maintenance calories = Mifflin–St Jeor BMR × activity multiplier.',
      assumption: `${result.activity.detail}. Activity levels are broad estimates, not measured energy expenditure.`,
    }),
  }),
  defineCalculator({
    id: 'pace', shortName: 'Pace', name: 'Distance, duration, and pace',
    description: 'Enter any two values and calculate the third.',
    defaults: { solveFor: 'pace', distanceUnit: 'km', distance: '5', duration: '30:00', pace: '06:00' }, inputs: paceInputs,
    calculate: calculatePace,
    present: (result, values) => pacePresentation(result, values.solveFor),
  }),
])

export const healthCalculatorsById = new Map(healthCalculators.map((item) => [item.id, item]))

function bodyDefaults() { return { unitSystem: 'metric', height: '175', weight: '70' } }
function bodyInputs(values) { return [select('unitSystem', 'Units', unitOptions), number('height', 'Height', values.unitSystem === 'metric' ? 'cm' : 'in'), number('weight', 'Weight', values.unitSystem === 'metric' ? 'kg' : 'lb')] }
function metabolicInputs(values) { return [...bodyInputs(values), number('age', 'Age', 'years'), select('sex', 'Sex used by formula', sexOptions)] }
function maintenanceInputs(values) { return [...metabolicInputs(values), select('activityMultiplier', 'Activity level', activityLevels.map(({ label, value }) => ({ label, value })))] }
function paceInputs(values) { return [select('solveFor', 'Value to calculate', solveOptions), select('distanceUnit', 'Distance unit', distanceUnitOptions), ...(values.solveFor === 'distance' ? [] : [number('distance', 'Distance', values.distanceUnit)]), ...(values.solveFor === 'duration' ? [] : [text('duration', 'Duration', 'MM:SS or HH:MM:SS')]), ...(values.solveFor === 'pace' ? [] : [text('pace', 'Pace', `MM:SS per ${values.distanceUnit}`)])] }

function pacePresentation(result, solveFor) {
  const values = { distance: `${result.distance.toFixed(2)} ${result.distanceUnit}`, duration: formatClockDuration(result.duration), pace: `${formatClockDuration(result.pace)} per ${result.distanceUnit}` }
  const labels = { distance: 'Distance', duration: 'Duration', pace: 'Pace' }
  return {
    primary: { label: labels[solveFor], value: values[solveFor] },
    rows: Object.keys(values).filter((key) => key !== solveFor).map((key) => ({ label: labels[key], value: values[key] })).concat({ label: 'Average speed', value: `${result.speed.toFixed(2)} ${result.distanceUnit}/h` }),
    formula: 'Distance = speed × time. Pace = duration ÷ distance.',
    assumption: 'The pace stays constant across the full distance.',
  }
}

function defineCalculator(value) { return Object.freeze(value) }
function select(id, label, options) { return { id, label, type: 'select', options } }
function number(id, label, suffix) { return { id, label, type: 'number', suffix } }
function text(id, label, placeholder) { return { id, label, type: 'text', placeholder } }
