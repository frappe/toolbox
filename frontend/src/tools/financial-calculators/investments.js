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

export function calculateSip({ monthlyInvestment, annualRate, durationYears }) {
  requirePositive(monthlyInvestment, 'Monthly investment')
  requireNonNegative(annualRate, 'Expected annual return')
  requirePositive(durationYears, 'Duration')
  requireAtMost(monthlyInvestment, 1_000_000_000_000_000, 'Monthly investment')
  requireAtMost(annualRate, 1_000, 'Expected annual return')
  requireAtMost(durationYears, 100, 'Duration')

  const rawMonths = durationYears * 12
  if (!Number.isInteger(rawMonths)) {
    throw new FinancialCalculationError('Duration must contain a whole number of months.')
  }

  const monthlyRate = annualRate / 100 / 12
  const futureValue = requireFiniteResult(
    monthlyRate === 0
      ? monthlyInvestment * rawMonths
      : monthlyInvestment * (((1 + monthlyRate) ** rawMonths - 1) / monthlyRate),
  )
  const totalInvested = monthlyInvestment * rawMonths

  return {
    futureValue,
    totalInvested,
    estimatedGain: futureValue - totalInvested,
    months: rawMonths,
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
