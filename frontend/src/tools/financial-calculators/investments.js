import { FinancialCalculationError } from './errors'
import {
  requireAtMost,
  requireFiniteResult,
  requireNonNegative,
  requirePositive,
  requireWholePositive,
} from './validation'

export function calculateCompoundInterest({
  principal,
  annualRate,
  durationYears,
  compoundsPerYear,
  contributionPerPeriod = 0,
}) {
  requireNonNegative(principal, 'Principal')
  requireNonNegative(annualRate, 'Annual interest rate')
  requirePositive(durationYears, 'Duration')
  requireWholePositive(compoundsPerYear, 'Compounding frequency')
  requireNonNegative(contributionPerPeriod, 'Recurring contribution')
  requireAtMost(principal, 1_000_000_000_000_000, 'Principal')
  requireAtMost(annualRate, 1_000, 'Annual interest rate')
  requireAtMost(durationYears, 100, 'Duration')
  requireAtMost(compoundsPerYear, 365, 'Compounding frequency')
  requireAtMost(contributionPerPeriod, 1_000_000_000_000_000, 'Recurring contribution')
  if (principal === 0 && contributionPerPeriod === 0) {
    throw new FinancialCalculationError('Enter a principal or a recurring contribution.')
  }

  const rawPeriods = durationYears * compoundsPerYear
  if (!Number.isInteger(rawPeriods)) {
    throw new FinancialCalculationError(
      'Duration must contain a whole number of compounding periods.',
    )
  }
  requireAtMost(rawPeriods, 36_500, 'Number of compounding periods')

  const periodicRate = annualRate / 100 / compoundsPerYear
  const growth = (1 + periodicRate) ** rawPeriods
  const principalValue = principal * growth
  const contributionValue =
    periodicRate === 0
      ? contributionPerPeriod * rawPeriods
      : contributionPerPeriod * ((growth - 1) / periodicRate)
  const totalContribution = principal + contributionPerPeriod * rawPeriods
  const finalAmount = requireFiniteResult(principalValue + contributionValue)

  return {
    finalAmount,
    totalContribution,
    interestEarned: finalAmount - totalContribution,
    periods: rawPeriods,
  }
}

export function calculateSip({ monthlyInvestment, annualRate, durationYears, annualStepUpRate = 0 }) {
  requirePositive(monthlyInvestment, 'Monthly investment')
  requireNonNegative(annualRate, 'Expected annual return')
  requirePositive(durationYears, 'Duration')
  requireNonNegative(annualStepUpRate, 'Annual step-up')
  requireAtMost(monthlyInvestment, 1_000_000_000_000_000, 'Monthly investment')
  requireAtMost(annualRate, 1_000, 'Expected annual return')
  requireAtMost(durationYears, 100, 'Duration')
  requireAtMost(annualStepUpRate, 1_000, 'Annual step-up')

  const rawMonths = durationYears * 12
  if (!Number.isInteger(rawMonths)) {
    throw new FinancialCalculationError('Duration must contain a whole number of months.')
  }

  const monthlyRate = annualRate / 100 / 12
  const stepUp = annualStepUpRate / 100

  // Walk the annuity-due recurrence, snapshotting the balance at each year for the
  // growth chart. The monthly amount rises by the step-up after each completed year;
  // a 0% step-up reproduces the closed form used below for the headline figure.
  const series = []
  let balance = 0
  let ranTotalInvested = 0
  for (let month = 0; month < rawMonths; month += 1) {
    const contribution = monthlyInvestment * (1 + stepUp) ** Math.floor(month / 12)
    ranTotalInvested += contribution
    balance = (balance + contribution) * (1 + monthlyRate)
    if ((month + 1) % 12 === 0 || month === rawMonths - 1) {
      series.push({ year: (month + 1) / 12, value: balance })
    }
  }

  let futureValue
  let totalInvested
  if (stepUp === 0) {
    const growth = (1 + monthlyRate) ** rawMonths
    futureValue = requireFiniteResult(
      monthlyRate === 0
        ? monthlyInvestment * rawMonths
        : monthlyInvestment * ((growth - 1) / monthlyRate) * (1 + monthlyRate),
    )
    totalInvested = monthlyInvestment * rawMonths
  } else {
    futureValue = requireFiniteResult(balance)
    totalInvested = requireFiniteResult(ranTotalInvested)
  }

  return {
    futureValue,
    totalInvested,
    estimatedGain: futureValue - totalInvested,
    months: rawMonths,
    stepUpApplied: stepUp !== 0,
    series,
  }
}

export function calculateProjectedValue({ startingValue, annualRate, durationYears }) {
  requirePositive(startingValue, 'Starting value')
  requireNonNegative(annualRate, 'Annual growth rate')
  requirePositive(durationYears, 'Duration')
  requireAtMost(startingValue, 1_000_000_000_000_000, 'Starting value')
  requireAtMost(annualRate, 1_000, 'Annual growth rate')
  requireAtMost(durationYears, 1_000, 'Duration')

  const rate = annualRate / 100
  const endingValue = requireFiniteResult(startingValue * (1 + rate) ** durationYears)

  const series = []
  const wholeYears = Math.floor(durationYears)
  for (let year = 1; year <= wholeYears; year += 1) {
    series.push({ year, value: startingValue * (1 + rate) ** year })
  }
  if (durationYears !== wholeYears) series.push({ year: durationYears, value: endingValue })

  return {
    endingValue,
    totalGrowth: endingValue - startingValue,
    series,
  }
}

export function calculateCagr({ startingValue, endingValue, durationYears }) {
  requirePositive(startingValue, 'Starting value')
  requirePositive(endingValue, 'Ending value')
  requirePositive(durationYears, 'Duration')
  requireAtMost(startingValue, 1_000_000_000_000_000, 'Starting value')
  requireAtMost(endingValue, 1_000_000_000_000_000, 'Ending value')
  requireAtMost(durationYears, 1_000, 'Duration')

  return {
    cagr: requireFiniteResult(((endingValue / startingValue) ** (1 / durationYears) - 1) * 100),
    absoluteChange: endingValue - startingValue,
  }
}
