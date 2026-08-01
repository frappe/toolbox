import { describe, expect, it } from 'vitest'

import { formatCalculatorResult } from './formatCalculatorResult'

describe('formatCalculatorResult', () => {
  it.each([
    [5, '5'],
    [1 / 3, '0.333333333333'],
    [-0, '0'],
    [1.25e12, '1.25e12'],
    [4.5e-10, '4.5e-10'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatCalculatorResult(value)).toBe(expected)
  })

  it('rejects non-finite values at the display boundary', () => {
    expect(() => formatCalculatorResult(Number.POSITIVE_INFINITY)).toThrow(
      'Calculator results must be finite numbers.',
    )
  })
})
