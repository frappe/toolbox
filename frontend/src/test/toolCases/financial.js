// Six calculators, one view. Every figure below was computed in Python with Decimal from the
// published formula, so a rounding change in the application shows up here rather than agreeing
// with itself.
//
// The headline value is the closed-form result. The totals are not: the schedule clears the
// balance on the final period, which the documented behavior says it should, so a total is very
// slightly under payment x periods.
const primary = { role: 'status', name: 'Primary financial result' }

export const financialCases = [
  {
    toolId: 'emi-calculator',
    route: '/emi-calculator',
    primary,
    cases: [
      {
        name: 'a twenty-year home loan at nine percent',
        fill: [
          { label: 'Principal', value: '500000' },
          { label: 'Annual interest rate', value: '9' },
          { label: 'Loan duration', value: '20' },
        ],
        expect: {
          primary: '₹4,498.63',
          contains: ['₹5,79,671.15', '₹10,79,671.15', '240'],
        },
      },
      {
        name: 'an interest-free loan divides evenly',
        fill: [
          { label: 'Principal', value: '120000' },
          { label: 'Annual interest rate', value: '0' },
          { label: 'Loan duration', value: '1' },
        ],
        expect: { primary: '₹10,000.00', contains: ['₹0.00'] },
      },
      {
        name: 'refuses a principal of zero',
        fill: [{ label: 'Principal', value: '0' }],
        expect: { alert: /Principal/ },
      },
    ],
  },
  {
    toolId: 'compound-interest-calculator',
    route: '/compound-interest-calculator',
    primary,
    cases: [
      {
        name: 'quarterly compounding with a recurring contribution',
        fill: [
          { label: 'Principal', value: '200000' },
          { label: 'Annual interest rate', value: '7' },
          { label: 'Duration', value: '15' },
          { select: 'Compounding frequency', option: 'Quarterly' },
          { label: 'Contribution per period', value: '2500' },
        ],
        // "Total contribution" counts the principal as well as the 60 recurring payments, so it
        // is 200,000 + 150,000 rather than the contributions on their own.
        expect: {
          primary: '₹8,28,051.30',
          contains: ['₹3,50,000.00', '₹4,78,051.30', '60'],
        },
      },
    ],
  },
  {
    toolId: 'sip-calculator',
    route: '/sip-calculator',
    primary,
    cases: [
      {
        name: 'a twelve-year monthly plan at eleven percent',
        fill: [
          { label: 'Monthly investment', value: '15000' },
          { label: 'Expected annual return', value: '11' },
          { label: 'Duration', value: '12' },
          { label: 'Annual step-up', value: '0' },
        ],
        expect: {
          primary: '₹44,93,325.25',
          contains: ['₹21,60,000.00', '₹23,33,325.25', '144'],
        },
      },
      {
        name: 'a step-up raises the projection above a flat plan',
        fill: [
          { label: 'Monthly investment', value: '15000' },
          { label: 'Expected annual return', value: '11' },
          { label: 'Duration', value: '12' },
          { label: 'Annual step-up', value: '10' },
        ],
        // The step-up path uses its own summation rather than the annuity formula, so this case
        // establishes the direction and the wording rather than a figure.
        expect: { contains: ['step-up'], primaryAbove: 4_493_325.25 },
      },
    ],
  },
  {
    toolId: 'cagr-calculator',
    route: '/cagr-calculator',
    primary,
    cases: [
      {
        name: 'growth from 250,000 to 475,000 over seven years',
        fill: [
          { label: 'Starting value', value: '250000' },
          { label: 'Ending value', value: '475000' },
          { label: 'Duration', value: '7' },
        ],
        expect: { primary: '9.60%', contains: ['₹2,25,000.00'] },
      },
      {
        name: 'a value that did not move has no growth rate',
        fill: [
          { label: 'Starting value', value: '100000' },
          { label: 'Ending value', value: '100000' },
          { label: 'Duration', value: '5' },
        ],
        expect: { primary: '0.00%' },
      },
    ],
  },
  {
    toolId: 'future-value-calculator',
    route: '/future-value-calculator',
    primary,
    cases: [
      {
        name: 'eight years of growth at nine and a half percent',
        fill: [
          { label: 'Starting value', value: '150000' },
          { label: 'Annual growth rate', value: '9.5' },
          { label: 'Duration', value: '8' },
        ],
        expect: { primary: '₹3,10,030.35', contains: ['₹1,60,030.35'] },
      },
    ],
  },
  {
    toolId: 'break-even-calculator',
    route: '/break-even-calculator',
    primary,
    cases: [
      {
        name: 'rounds the break-even quantity up to a whole unit',
        fill: [
          { label: 'Fixed cost', value: '750000' },
          { label: 'Selling price per unit', value: '2400' },
          { label: 'Variable cost per unit', value: '1450' },
        ],
        // 750,000 / 950 = 789.4737 units. A part unit cannot be sold, so the quantity rounds up
        // to 790 and the revenue is priced at that quantity.
        expect: {
          primary: '790 units',
          contains: ['₹950.00', '789.47', '₹18,96,000.00'],
        },
      },
      {
        name: 'refuses a selling price below the variable cost',
        fill: [
          { label: 'Fixed cost', value: '750000' },
          { label: 'Selling price per unit', value: '1000' },
          { label: 'Variable cost per unit', value: '1450' },
        ],
        expect: { alert: /greater than variable cost/ },
      },
    ],
  },
]
