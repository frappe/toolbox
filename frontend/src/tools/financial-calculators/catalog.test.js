import { describe, expect, it } from 'vitest'

import { calculateBreakEven, calculateLoan } from './index'
import { financialCalculatorsById } from './catalog'

function present(id, result) {
  return financialCalculatorsById.get(id).present(result)
}

describe('EMI presentation chart', () => {
  it('samples a declining balance from the principal down to zero', () => {
    const result = calculateLoan({
      principal: 1_200_000,
      annualRate: 9,
      durationYears: 3,
      paymentsPerYear: 12,
    })
    const { chart } = present('emi', result)

    expect(chart.ariaLabel).toContain('balance')
    // One point per year plus the starting principal (year 0).
    expect(chart.series[0]).toEqual({ year: 0, value: 1_200_000 })
    expect(chart.series.at(-1).value).toBe(0)
    expect(chart.series.at(-1).year).toBe(3)
    // Balance strictly decreases across the sampled years.
    for (let index = 1; index < chart.series.length; index += 1) {
      expect(chart.series[index].value).toBeLessThan(chart.series[index - 1].value)
    }
  })
})

describe('break-even presentation chart', () => {
  it('exposes the cost and revenue parameters for the crossover chart', () => {
    const result = calculateBreakEven({ fixedCost: 500_000, sellingPrice: 1_500, variableCost: 900 })
    const { chart } = present('break-even', result)

    expect(chart.type).toBe('break-even')
    expect(chart.fixedCost).toBe(500_000)
    expect(chart.sellingPrice).toBe(1_500)
    expect(chart.variableCost).toBe(900)
    expect(chart.breakEvenQuantity).toBe(result.breakEvenQuantity)
    // Revenue and cost are equal at the exact break-even quantity.
    const revenue = chart.sellingPrice * chart.exactQuantity
    const cost = chart.fixedCost + chart.variableCost * chart.exactQuantity
    expect(revenue).toBeCloseTo(cost, 6)
  })
})
