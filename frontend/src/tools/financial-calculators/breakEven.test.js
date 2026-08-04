import { describe, expect, it } from 'vitest'

import { calculateBreakEven, FinancialCalculationError } from './index'

describe('calculateBreakEven', () => {
  it('matches a documented whole-unit break-even vector', () => {
    const result = calculateBreakEven({
      fixedCost: 1_000,
      sellingPrice: 50,
      variableCost: 30,
    })

    expect(result.contributionPerUnit).toBe(20)
    expect(result.exactQuantity).toBe(50)
    expect(result.breakEvenQuantity).toBe(50)
    expect(result.breakEvenRevenue).toBe(2_500)
    // Inputs are echoed back so the break-even chart can draw the cost and revenue lines.
    expect(result.fixedCost).toBe(1_000)
    expect(result.sellingPrice).toBe(50)
    expect(result.variableCost).toBe(30)
  })

  it('rounds the required quantity up to a saleable whole unit', () => {
    const result = calculateBreakEven({
      fixedCost: 1_001,
      sellingPrice: 50,
      variableCost: 30,
    })
    expect(result.exactQuantity).toBeCloseTo(50.05, 8)
    expect(result.breakEvenQuantity).toBe(51)
    expect(result.breakEvenRevenue).toBe(2_550)
  })

  it('rejects a zero or negative contribution margin', () => {
    expect(() =>
      calculateBreakEven({ fixedCost: 1_000, sellingPrice: 30, variableCost: 30 }),
    ).toThrow(FinancialCalculationError)
    expect(() =>
      calculateBreakEven({ fixedCost: 1_000, sellingPrice: 20, variableCost: 30 }),
    ).toThrow('Selling price must be greater')
  })
})
