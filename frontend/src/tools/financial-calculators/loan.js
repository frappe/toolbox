import { FinancialCalculationError } from './errors'
import {
  requireAtMost,
  requireFiniteResult,
  requireNonNegative,
  requirePositive,
  requireWholePositive,
} from './validation'

export function calculateLoan({ principal, annualRate, durationYears, paymentsPerYear = 12 }) {
  requirePositive(principal, 'Principal')
  requireNonNegative(annualRate, 'Annual interest rate')
  requirePositive(durationYears, 'Loan duration')
  requireWholePositive(paymentsPerYear, 'Payments per year')
  requireAtMost(principal, 1_000_000_000_000_000, 'Principal')
  requireAtMost(annualRate, 1_000, 'Annual interest rate')
  requireAtMost(durationYears, 100, 'Loan duration')
  requireAtMost(paymentsPerYear, 365, 'Payments per year')

  const rawPeriods = durationYears * paymentsPerYear
  if (!Number.isInteger(rawPeriods)) {
    throw new FinancialCalculationError(
      'Loan duration must contain a whole number of payment periods.',
    )
  }
  requireAtMost(rawPeriods, 1_200, 'Number of payment periods')

  const periodicRate = annualRate / 100 / paymentsPerYear
  const regularPayment = requireFiniteResult(
    calculatePeriodicPayment(principal, periodicRate, rawPeriods),
  )
  const schedule = buildAmortizationSchedule({
    principal,
    periodicRate,
    periods: rawPeriods,
    regularPayment,
  })
  const totalPayment = schedule.reduce((sum, row) => sum + row.payment, 0)
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0)

  return {
    payment: regularPayment,
    totalInterest,
    totalPayment,
    periods: rawPeriods,
    paymentsPerYear,
    schedule,
  }
}

function calculatePeriodicPayment(principal, periodicRate, periods) {
  if (periodicRate === 0) return principal / periods
  const growth = (1 + periodicRate) ** periods
  return (principal * periodicRate * growth) / (growth - 1)
}

function buildAmortizationSchedule({ principal, periodicRate, periods, regularPayment }) {
  const schedule = []
  let balance = principal

  for (let period = 1; period <= periods; period += 1) {
    const interest = balance * periodicRate
    const principalPaid =
      period === periods ? balance : Math.min(regularPayment - interest, balance)
    const payment = principalPaid + interest
    balance = Math.max(0, balance - principalPaid)
    schedule.push({ period, payment, principal: principalPaid, interest, balance })
  }

  return schedule
}
