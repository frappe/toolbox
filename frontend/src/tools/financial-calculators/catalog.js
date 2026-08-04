import {
  calculateBreakEven,
  calculateCagr,
  calculateCompoundInterest,
  calculateLoan,
  calculateProjectedValue,
  calculateSip,
  FinancialCalculationError,
} from './index'

const frequencyOptions = [
  { label: 'Monthly', value: '12' },
  { label: 'Quarterly', value: '4' },
  { label: 'Yearly', value: '1' },
]

export const financialCalculators = Object.freeze([
  defineCalculator({
    id: 'emi',
    name: 'EMI',
    shortName: 'EMI',
    description: 'Estimate periodic loan payments and inspect the full amortization schedule.',
    inputs: [
      currencyInput('principal', 'Principal', '1000000'),
      percentInput('annualRate', 'Annual interest rate', '8.5', '% per year'),
      numberInput('durationYears', 'Loan duration', '5', 'years'),
      selectInput('paymentsPerYear', 'Payment frequency', '12', frequencyOptions),
    ],
    calculate: (values) => calculateLoan(values),
    present: presentLoan,
  }),
  defineCalculator({
    id: 'compound-interest',
    name: 'Compound interest',
    shortName: 'Compound',
    description: 'Project growth with optional end-of-period recurring contributions.',
    inputs: [
      currencyInput('principal', 'Principal', '100000'),
      percentInput('annualRate', 'Annual interest rate', '8', '% per year'),
      numberInput('durationYears', 'Duration', '10', 'years'),
      selectInput('compoundsPerYear', 'Compounding frequency', '4', frequencyOptions),
      currencyInput('contributionPerPeriod', 'Contribution per period', '5000'),
    ],
    calculate: (values) => calculateCompoundInterest(values),
    present: presentCompoundInterest,
  }),
  defineCalculator({
    id: 'sip',
    name: 'SIP projection',
    shortName: 'SIP',
    description: 'Estimate a monthly investment plan with contributions made at month-start.',
    inputs: [
      currencyInput('monthlyInvestment', 'Monthly investment', '10000'),
      percentInput('annualRate', 'Expected annual return', '12', '% per year'),
      numberInput('durationYears', 'Duration', '10', 'years'),
      percentInput('annualStepUpRate', 'Annual step-up', '0', '% per year'),
    ],
    calculate: (values) => calculateSip(values),
    present: presentSip,
  }),
  defineCalculator({
    id: 'cagr',
    name: 'CAGR',
    shortName: 'CAGR',
    description: 'Measure the constant annual growth rate between two values.',
    inputs: [
      currencyInput('startingValue', 'Starting value', '100000'),
      currencyInput('endingValue', 'Ending value', '200000'),
      numberInput('durationYears', 'Duration', '5', 'years'),
    ],
    calculate: (values) => calculateCagr(values),
    present: presentCagr,
  }),
  defineCalculator({
    id: 'projected-value',
    name: 'Projected value',
    shortName: 'Projected',
    description: 'Grow a starting value at a constant annual rate to see its future value.',
    inputs: [
      currencyInput('startingValue', 'Starting value', '100000'),
      percentInput('annualRate', 'Annual growth rate', '12', '% per year'),
      numberInput('durationYears', 'Duration', '5', 'years'),
    ],
    calculate: (values) => calculateProjectedValue(values),
    present: presentProjectedValue,
  }),
  defineCalculator({
    id: 'break-even',
    name: 'Break-even',
    shortName: 'Break-even',
    description: 'Find the whole-unit sales volume needed to cover fixed and variable costs.',
    inputs: [
      currencyInput('fixedCost', 'Fixed cost', '500000'),
      currencyInput('sellingPrice', 'Selling price per unit', '1500'),
      currencyInput('variableCost', 'Variable cost per unit', '900'),
    ],
    calculate: (values) => calculateBreakEven(values),
    present: presentBreakEven,
  }),
])

export const financialCalculatorsById = new Map(
  financialCalculators.map((calculator) => [calculator.id, calculator]),
)

export function calculateFinancialCalculator(calculator, inputValues) {
  const values = {}
  for (const input of calculator.inputs) {
    const rawValue = String(inputValues[input.id] ?? '').trim()
    if (!rawValue) throw new FinancialCalculationError(`${input.label} is required.`)
    values[input.id] = Number(rawValue)
  }
  return calculator.calculate(values)
}

export function createDefaultFinancialInputs(calculator) {
  return Object.fromEntries(calculator.inputs.map((input) => [input.id, input.defaultValue]))
}

function presentLoan(result) {
  const frequency = frequencyOptions.find(
    (option) => Number(option.value) === result.paymentsPerYear,
  )?.label
  return {
    primary: {
      label: `${frequency ?? 'Periodic'} payment`,
      value: result.payment,
      format: 'currency',
    },
    rows: [
      { label: 'Total interest', value: result.totalInterest, format: 'currency' },
      { label: 'Total payment', value: result.totalPayment, format: 'currency' },
      { label: 'Number of payments', value: result.periods, format: 'number' },
    ],
    formula: 'Payment = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1).',
    assumption:
      'The annual rate is split evenly across periods. Payments occur at each period end.',
    schedule: result.schedule,
  }
}

function presentCompoundInterest(result) {
  return {
    primary: { label: 'Final amount', value: result.finalAmount, format: 'currency' },
    rows: [
      { label: 'Total contribution', value: result.totalContribution, format: 'currency' },
      { label: 'Interest earned', value: result.interestEarned, format: 'currency' },
      { label: 'Compounding periods', value: result.periods, format: 'number' },
    ],
    formula: 'Future value combines compound growth and an ordinary annuity.',
    assumption: 'The rate stays constant. Recurring contributions occur at each period end.',
  }
}

function presentSip(result) {
  return {
    primary: {
      label: 'Estimated future value',
      value: result.futureValue,
      format: 'currency',
    },
    rows: [
      { label: 'Total invested', value: result.totalInvested, format: 'currency' },
      { label: 'Estimated gain', value: result.estimatedGain, format: 'currency' },
      { label: 'Monthly contributions', value: result.months, format: 'number' },
    ],
    formula: result.stepUpApplied
      ? 'Each month-start contribution grows to the horizon; the monthly amount rises by the step-up after every completed year.'
      : 'Future value = P × ((1 + r)ⁿ − 1) ÷ r × (1 + r).',
    assumption: result.stepUpApplied
      ? 'Contributions occur at month-start. The expected return and the annual step-up stay constant.'
      : 'Contributions occur at month-start. The expected annual return stays constant.',
    chart: { series: result.series, ariaLabel: 'Projected SIP value each year' },
  }
}

function presentProjectedValue(result) {
  return {
    primary: { label: 'Projected value', value: result.endingValue, format: 'currency' },
    rows: [{ label: 'Total growth', value: result.totalGrowth, format: 'currency' }],
    formula: 'Projected value = starting value × (1 + rate)^years.',
    assumption: 'The growth rate stays constant for the whole period.',
    chart: { series: result.series, ariaLabel: 'Projected value each year' },
  }
}

function presentCagr(result) {
  return {
    primary: { label: 'Compound annual growth rate', value: result.cagr, format: 'percent' },
    rows: [{ label: 'Absolute change', value: result.absoluteChange, format: 'currency' }],
    formula: 'CAGR = ((ending value ÷ starting value)^(1 ÷ years) − 1) × 100.',
    assumption: 'CAGR smooths all changes into one constant annual rate.',
  }
}

function presentBreakEven(result) {
  return {
    primary: {
      label: 'Break-even quantity',
      value: result.breakEvenQuantity,
      format: 'units',
    },
    rows: [
      {
        label: 'Contribution per unit',
        value: result.contributionPerUnit,
        format: 'currency',
      },
      { label: 'Exact break-even quantity', value: result.exactQuantity, format: 'decimal' },
      { label: 'Break-even revenue', value: result.breakEvenRevenue, format: 'currency' },
    ],
    formula: 'Break-even quantity = fixed cost ÷ (selling price − variable cost).',
    assumption:
      'The required quantity rounds up to the next whole unit, so break-even revenue uses it.',
  }
}

function defineCalculator(calculator) {
  return Object.freeze(calculator)
}

function currencyInput(id, label, defaultValue) {
  return numberInput(id, label, defaultValue, 'currency')
}

function percentInput(id, label, defaultValue, suffix) {
  return numberInput(id, label, defaultValue, suffix)
}

function numberInput(id, label, defaultValue, suffix) {
  return { id, label, defaultValue, type: 'number', suffix }
}

function selectInput(id, label, defaultValue, options) {
  return { id, label, defaultValue, type: 'select', options }
}
