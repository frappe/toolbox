import { describe, expect, it } from 'vitest'
import { convertCurrency, CurrencyConversionError } from './converter'

const rates = { EUR: 1, USD: 1.2, INR: 100 }

describe('currency conversion', () => {
  it('converts through the ECB euro base', () => {
    expect(convertCurrency(100, 'USD', 'INR', rates)).toBeCloseTo(8333.333333, 6)
    expect(convertCurrency(100, 'INR', 'USD', rates)).toBeCloseTo(1.2, 8)
    expect(convertCurrency(100, 'EUR', 'USD', rates)).toBe(120)
  })

  it('rejects invalid amounts, currencies, and rates', () => {
    expect(() => convertCurrency(-1, 'EUR', 'USD', rates)).toThrow(CurrencyConversionError)
    expect(() => convertCurrency(Infinity, 'EUR', 'USD', rates)).toThrow(CurrencyConversionError)
    expect(() => convertCurrency(1, 'EUR', 'BAD', rates)).toThrow(CurrencyConversionError)
  })
})
