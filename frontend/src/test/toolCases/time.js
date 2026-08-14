// Fixed cities, so the converter reads the same on any machine. Kolkata is UTC+5:30 all year,
// London is UTC+0 in January, and New York is UTC−5 in January. None of the three observes a
// transition on 1 January, which is why the case uses that date.
export const WORLD_CLOCK_LOCATIONS = [
  { id: 'seed-kolkata', zone: 'Asia/Kolkata', label: 'Kolkata', favourite: false },
  { id: 'seed-london', zone: 'Europe/London', label: 'London', favourite: false },
  { id: 'seed-new-york', zone: 'America/New_York', label: 'New York', favourite: false },
]

export const timeCases = [
  {
    toolId: 'time-zone-converter',
    route: '/time-zone-converter',
    seed: { savedWorldClockLocations: WORLD_CLOCK_LOCATIONS },
    cases: [
      {
        name: 'nine in the morning in Kolkata is half past three in London',
        // IST is UTC+5:30 and London keeps GMT in January, so the gap is five and a half hours.
        fill: [
          { select: "In this city's time", option: 'Kolkata' },
          { label: 'Date and time', value: '2026-01-01 09:00:00', submit: true },
        ],
        expect: { contains: ['03:30'] },
      },
      {
        name: 'the same moment is the evening before in New York',
        // EST is UTC−5, so 09:00 in Kolkata is 22:30 on the last day of the old year. The cards
        // are written on a twelve-hour clock.
        fill: [
          { select: "In this city's time", option: 'Kolkata' },
          { label: 'Date and time', value: '2026-01-01 09:00:00', submit: true },
        ],
        // WebKit writes the meridiem uppercase where Chromium and Firefox write it lowercase.
        expect: { contains: [/10:30\s*pm/i, '31/12/2025', 'Previous day'] },
      },
    ],
  },
  {
    toolId: 'world-clock',
    route: '/world-clock',
    seed: { savedWorldClockLocations: WORLD_CLOCK_LOCATIONS },
    cases: [
      {
        name: 'shows a running clock for each saved city',
        fill: [],
        expect: { contains: [/\d{2}:\d{2}/, 'Asia/Kolkata', 'Europe/London'] },
      },
      {
        name: 'adds a city from the search',
        fill: [
          { combobox: 'Add a city or time zone', value: 'Tokyo', option: /Tokyo/ },
        ],
        expect: { contains: ['Asia/Tokyo'] },
      },
    ],
  },
  {
    toolId: 'timer',
    route: '/timer',
    cases: [
      {
        name: 'counts a set duration down and can be paused',
        fill: [
          { label: 'Minutes', value: '1' },
          { click: 'Set timer' },
          { click: 'Start' },
        ],
        expect: { control: 'Pause' },
      },
    ],
  },
  {
    toolId: 'stopwatch',
    route: '/stopwatch',
    cases: [
      {
        name: 'records a lap while running',
        fill: [{ click: 'Start' }, { click: 'Lap' }],
        expect: { contains: ['Lap 1'] },
      },
    ],
  },
  {
    toolId: 'countdown-timer',
    route: '/countdown-timer',
    cases: [
      {
        name: 'counts down to a target it names',
        fill: [
          { label: 'Duration in minutes', value: '2' },
          { click: 'Start countdown' },
        ],
        expect: { contains: ['Target:'] },
      },
    ],
  },
]
