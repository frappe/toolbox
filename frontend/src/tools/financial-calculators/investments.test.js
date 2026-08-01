import { describe, expect, it } from 'vitest'

import {
  calculateCagr,
  calculateCompoundInterest,
  calculateSip,
  FinancialCalculationError,
} from './index'

describe('calculateCompoundInterest', () => {
  it('matches an annual contribution vector with end-of-period contributions', () => {
    const result = calculateCompoundInterest({
      principal: 10_000,
      annualRate: 10,
      durationYears: 2,
      compoundsPerYear: 1,
      contributionPerPeriod: 1_000,
    })

    expect(result.finalAmount).toBeCloseTo(14_200, 8)
    expect(result.totalContribution).toBe(12_000)
    expect(result.interestEarned).toBeCloseTo(2_200, 8)
  })

  it('handles zero interest and contribution-only plans', () => {
    const result = calculateCompoundInterest({
      principal: 0,
      annualRate: 0,
      durationYears: 2,
      compoundsPerYear: 4,
      contributionPerPeriod: 500,
    })

    expect(result.finalAmount).toBe(4_000)
    expect(result.interestEarned).toBe(0)
  })

  it('rejects a plan with no money or fractional periods', () => {
    expect(() =>
      calculateCompoundInterest({
        principal: 0,
        annualRate: 5,
        durationYears: 2,
        compoundsPerYear: 1,
        contributionPerPeriod: 0,
      }),
    ).toThrow(FinancialCalculationError)
    expect(() =>
      calculateCompoundInterest({
        principal: 100,
        annualRate: 5,
        durationYears: 1.1,
        compoundsPerYear: 4,
        contributionPerPeriod: 0,
      }),
    ).toThrow('whole number of compounding periods')
  })

  it('rejects rates and durations outside the supported bounds', () => {
    expect(() =>
      calculateCompoundInterest({
        principal: 100,
        annualRate: 1_001,
        durationYears: 1,
        compoundsPerYear: 1,
        contributionPerPeriod: 0,
      }),
    ).toThrow('Annual interest rate cannot exceed 1000')
  })
})

describe('calculateSip', () => {
  it('matches a monthly end-of-period contribution vector', () => {
    const result = calculateSip({
      monthlyInvestment: 1_000,
      annualRate: 12,
      durationYears: 1,
    })

    expect(result.futureValue).toBeCloseTo(12_682.503013, 6)
    expect(result.totalInvested).toBe(12_000)
    expect(result.estimatedGain).toBeCloseTo(682.503013, 6)
  })

  it('handles a zero-return projection', () => {
    const result = calculateSip({ monthlyInvestment: 2_000, annualRate: 0, durationYears: 2 })
    expect(result.futureValue).toBe(48_000)
    expect(result.estimatedGain).toBe(0)
  })
})

describe('calculateCagr', () => {
  it('calculates a documented ten-percent growth vector', () => {
    const result = calculateCagr({ startingValue: 100, endingValue: 121, durationYears: 2 })
    expect(result.cagr).toBeCloseTo(10, 10)
    expect(result.absoluteChange).toBe(21)
  })

  it('supports negative growth but rejects non-positive values', () => {
    expect(
      calculateCagr({ startingValue: 200, endingValue: 100, durationYears: 2 }).cagr,
    ).toBeLessThan(0)
    expect(() => calculateCagr({ startingValue: 0, endingValue: 100, durationYears: 2 })).toThrow(
      'Starting value must be greater than zero',
    )
  })
})
