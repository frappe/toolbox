import { describe, expect, it } from 'vitest'

import { calculateLoan, FinancialCalculationError } from './index'

describe('calculateLoan', () => {
  it('matches a documented monthly EMI vector', () => {
    const result = calculateLoan({
      principal: 100_000,
      annualRate: 12,
      durationYears: 1,
      paymentsPerYear: 12,
    })

    expect(result.payment).toBeCloseTo(8_884.878868, 6)
    expect(result.totalInterest).toBeCloseTo(6_618.54641, 5)
    expect(result.totalPayment).toBeCloseTo(106_618.54641, 5)
    expect(result.schedule).toHaveLength(12)
    expect(result.schedule.at(-1).balance).toBe(0)
  })

  it('reconciles every schedule row with the principal and interest totals', () => {
    const principal = 1_000_000
    const result = calculateLoan({
      principal,
      annualRate: 8.5,
      durationYears: 5,
      paymentsPerYear: 12,
    })
    const principalPaid = result.schedule.reduce((sum, row) => sum + row.principal, 0)
    const interestPaid = result.schedule.reduce((sum, row) => sum + row.interest, 0)
    const payments = result.schedule.reduce((sum, row) => sum + row.payment, 0)

    expect(principalPaid).toBeCloseTo(principal, 6)
    expect(interestPaid).toBeCloseTo(result.totalInterest, 6)
    expect(payments).toBeCloseTo(result.totalPayment, 6)
    expect(result.totalPayment).toBeCloseTo(principal + result.totalInterest, 6)
  })

  it('splits a zero-interest loan evenly', () => {
    const result = calculateLoan({
      principal: 12_000,
      annualRate: 0,
      durationYears: 1,
      paymentsPerYear: 12,
    })

    expect(result.payment).toBe(1_000)
    expect(result.totalInterest).toBe(0)
    expect(result.totalPayment).toBe(12_000)
  })

  it('rejects impossible inputs and fractional payment periods', () => {
    expect(() =>
      calculateLoan({ principal: -1, annualRate: 8, durationYears: 5, paymentsPerYear: 12 }),
    ).toThrow(FinancialCalculationError)
    expect(() =>
      calculateLoan({
        principal: 100,
        annualRate: 8,
        durationYears: 1.1,
        paymentsPerYear: 4,
      }),
    ).toThrow('whole number of payment periods')
  })

  it('bounds schedule size before allocating payment rows', () => {
    expect(() =>
      calculateLoan({
        principal: 100_000,
        annualRate: 8,
        durationYears: 100,
        paymentsPerYear: 365,
      }),
    ).toThrow('Number of payment periods cannot exceed 1200')
  })
})
