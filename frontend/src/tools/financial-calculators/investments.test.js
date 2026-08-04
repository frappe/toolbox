import { describe, expect, it } from 'vitest'

import {
  calculateCagr,
  calculateCompoundInterest,
  calculateProjectedValue,
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
  it('matches a monthly start-of-period contribution vector', () => {
    const result = calculateSip({
      monthlyInvestment: 1_000,
      annualRate: 12,
      durationYears: 1,
    })

    expect(result.futureValue).toBeCloseTo(12_809.328043, 6)
    expect(result.totalInvested).toBe(12_000)
    expect(result.estimatedGain).toBeCloseTo(809.328043, 6)
  })

  it('handles a zero-return projection', () => {
    const result = calculateSip({ monthlyInvestment: 2_000, annualRate: 0, durationYears: 2 })
    expect(result.futureValue).toBe(48_000)
    expect(result.estimatedGain).toBe(0)
  })

  it('reproduces the closed form when the step-up is zero', () => {
    const base = calculateSip({ monthlyInvestment: 5_000, annualRate: 12, durationYears: 5 })
    const zeroStep = calculateSip({
      monthlyInvestment: 5_000,
      annualRate: 12,
      durationYears: 5,
      annualStepUpRate: 0,
    })
    expect(zeroStep.futureValue).toBe(base.futureValue)
    expect(zeroStep.stepUpApplied).toBe(false)
  })

  it('raises contributions and future value with an annual step-up', () => {
    const flat = calculateSip({ monthlyInvestment: 10_000, annualRate: 12, durationYears: 3 })
    const stepped = calculateSip({
      monthlyInvestment: 10_000,
      annualRate: 12,
      durationYears: 3,
      annualStepUpRate: 10,
    })
    expect(stepped.stepUpApplied).toBe(true)
    expect(stepped.totalInvested).toBeGreaterThan(flat.totalInvested)
    expect(stepped.futureValue).toBeGreaterThan(flat.futureValue)
  })

  it('returns a rising yearly growth series for the chart', () => {
    const result = calculateSip({ monthlyInvestment: 10_000, annualRate: 12, durationYears: 5 })
    expect(result.series).toHaveLength(5)
    expect(result.series[0].year).toBe(1)
    expect(result.series.at(-1).value).toBeGreaterThan(result.series[0].value)
  })
})

describe('calculateProjectedValue', () => {
  it('grows a starting value at a constant rate (inverse of CAGR)', () => {
    const result = calculateProjectedValue({ startingValue: 100, annualRate: 10, durationYears: 2 })
    expect(result.endingValue).toBeCloseTo(121, 10)
    expect(result.totalGrowth).toBeCloseTo(21, 10)
  })

  it('rejects a non-positive starting value', () => {
    expect(() =>
      calculateProjectedValue({ startingValue: 0, annualRate: 10, durationYears: 2 }),
    ).toThrow('Starting value must be greater than zero')
  })

  it('returns a yearly series ending at the projected value', () => {
    const result = calculateProjectedValue({ startingValue: 100_000, annualRate: 10, durationYears: 3 })
    expect(result.series).toHaveLength(3)
    expect(result.series.at(-1).value).toBeCloseTo(result.endingValue, 6)
    expect(result.series.at(-1).value).toBeCloseTo(133_100, 4)
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
