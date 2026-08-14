// BMI is weight in kilograms over height in metres squared. BMR is Mifflin-St Jeor. Both are
// published formulas, so the figures below were computed from them directly rather than read off
// the tool. The categories are the adult WHO bands.
const primary = { role: 'status', name: 'Primary health result' }

export const healthCases = [
  {
    toolId: 'bmi-calculator',
    route: '/bmi-calculator',
    primary,
    cases: [
      {
        name: 'places 95 kg at 182 cm in the overweight band',
        // 95 / 1.82² = 28.6801
        fill: [
          { label: 'Height', value: '182' },
          { label: 'Weight', value: '95' },
        ],
        expect: { primary: '28.7', contains: ['Overweight'] },
      },
      {
        name: 'reads the same in imperial as in metric',
        // 71.65 in and 209.44 lb are the same person as 182 cm and 95 kg.
        fill: [
          { select: 'Units', option: 'Imperial' },
          { label: 'Height', value: '71.65' },
          { label: 'Weight', value: '209.44' },
        ],
        expect: { primary: '28.7', contains: ['Overweight'] },
      },
      {
        name: 'refuses a height outside the supported range',
        fill: [{ label: 'Height', value: '10' }],
        expect: { alert: /Height must be between/ },
      },
    ],
  },
  {
    toolId: 'bmr-calculator',
    route: '/bmr-calculator',
    primary,
    cases: [
      {
        name: 'resting energy for a 27-year-old woman of 58 kg at 165 cm',
        // 10(58) + 6.25(165) − 5(27) − 161 = 1315.25
        fill: [
          { label: 'Height', value: '165' },
          { label: 'Weight', value: '58' },
          { label: 'Age', value: '27' },
          { select: 'Sex used by formula', option: 'Female' },
        ],
        expect: { primary: '1,315 kcal/day', contains: ['Mifflin'] },
      },
    ],
  },
  {
    toolId: 'tdee-calculator',
    route: '/tdee-calculator',
    primary,
    cases: [
      {
        name: 'applies the very active multiplier to the same body',
        // 1315.25 × 1.725 = 2268.80625
        fill: [
          { label: 'Height', value: '165' },
          { label: 'Weight', value: '58' },
          { label: 'Age', value: '27' },
          { select: 'Sex used by formula', option: 'Female' },
          { select: 'Activity level', option: 'Very active' },
        ],
        expect: {
          primary: '2,269 kcal/day',
          contains: ['1,315 kcal/day', 'Very active × 1.725'],
        },
      },
    ],
  },
  {
    toolId: 'pace-calculator',
    route: '/pace-calculator',
    primary,
    // This tool writes "Distance", "Duration" and "Pace" on its result rows as well as on its
    // inputs, and one of the three is always a result. So the inputs are named by id.
    cases: [
      {
        name: 'ten kilometres at five and a half minutes each takes 55 minutes',
        fill: [
          { select: 'Value to calculate', option: 'Duration' },
          { id: 'pace-distance', value: '10' },
          { id: 'pace-pace', value: '05:30' },
        ],
        expect: { primary: '55:00', contains: ['10.91 km/h'] },
      },
      {
        name: 'solves the distance from a duration and a pace',
        fill: [
          { select: 'Value to calculate', option: 'Distance' },
          { id: 'pace-duration', value: '1:00:00' },
          { id: 'pace-pace', value: '04:00' },
        ],
        expect: { primary: '15.00 km' },
      },
      {
        name: 'refuses a clock value with more than 59 seconds',
        fill: [
          { select: 'Value to calculate', option: 'Duration' },
          { id: 'pace-pace', value: '05:99' },
        ],
        expect: { alert: /below 60/ },
      },
    ],
  },
]
