import { describe, expect, it } from 'vitest'

import {
  calculateGst,
  getStandardGstRate,
  GST_MODES,
  GST_SUPPLY_TYPES,
  GstCalculationError,
  isStandardGstRate,
  parseGstRateHandoff,
  roundCurrency,
  STANDARD_GST_RATES,
  validateCustomGstRate,
} from './index'

const intraStateAdd = {
  mode: GST_MODES.ADD,
  supplyType: GST_SUPPLY_TYPES.INTRA_STATE,
}

describe('GST rate registry', () => {
  it('keeps the committed standard rates in one immutable registry', () => {
    expect(STANDARD_GST_RATES.map((entry) => entry.rate)).toEqual([0, 0.25, 3, 5, 12, 18, 28])
    expect(new Set(STANDARD_GST_RATES.map((entry) => entry.id)).size).toBe(
      STANDARD_GST_RATES.length,
    )
    expect(Object.isFrozen(STANDARD_GST_RATES)).toBe(true)
    expect(STANDARD_GST_RATES.every(Object.isFrozen)).toBe(true)
    expect(getStandardGstRate('eighteen')).toMatchObject({ rate: 18, label: '18%' })
    expect(getStandardGstRate('unknown')).toBeUndefined()
    expect(getStandardGstRate('__proto__')).toBeUndefined()
    expect(getStandardGstRate('constructor')).toBeUndefined()
    expect(getStandardGstRate('prototype')).toBeUndefined()
  })

  it('identifies standard rates without treating custom rates as standard', () => {
    expect(isStandardGstRate(0.25)).toBe(true)
    expect(isStandardGstRate(18)).toBe(true)
    expect(isStandardGstRate(7.5)).toBe(false)
    expect(isStandardGstRate('18')).toBe(false)
  })

  it.each([0, 0.25, 7.5, 28, 100])('accepts the custom rate %s', (rate) => {
    expect(validateCustomGstRate(rate)).toBe(rate)
  })

  it.each([
    [NaN, 'INVALID_RATE'],
    [Infinity, 'INVALID_RATE'],
    ['18', 'INVALID_RATE'],
    [-0.01, 'INVALID_RATE'],
    [100.01, 'INVALID_RATE'],
    [7.12345, 'INVALID_RATE'],
  ])('rejects the invalid custom rate %s', (rate, code) => {
    expectGstError(() => validateCustomGstRate(rate), code)
  })

  it('parses untrusted HSN handoff values without propagating invalid data', () => {
    expect(parseGstRateHandoff('18')).toBe(18)
    expect(parseGstRateHandoff(' 0.25% ')).toBe(0.25)
    expect(parseGstRateHandoff(12)).toBe(12)
    expect(parseGstRateHandoff('7.1250')).toBe(7.125)
    expect(parseGstRateHandoff('')).toBeNull()
    expect(parseGstRateHandoff('18% extra')).toBeNull()
    expect(parseGstRateHandoff('-5')).toBeNull()
    expect(parseGstRateHandoff('101')).toBeNull()
    expect(parseGstRateHandoff({ rate: 18 })).toBeNull()
  })
})

describe('GST calculations', () => {
  it('adds intra-state GST and splits CGST and SGST', () => {
    expect(calculateGst({ ...intraStateAdd, amount: 1_000, rate: 18 })).toEqual({
      mode: 'add',
      supplyType: 'intra-state',
      rate: 18,
      inputAmount: 1_000,
      taxableValue: 1_000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      totalGst: 180,
      finalAmount: 1_180,
      inclusiveAmount: 1_180,
    })
  })

  it('adds inter-state GST entirely as IGST', () => {
    const result = calculateGst({
      mode: 'add',
      supplyType: 'inter-state',
      amount: 850.75,
      rate: 12,
    })

    expect(result).toMatchObject({
      taxableValue: 850.75,
      cgst: 0,
      sgst: 0,
      igst: 102.09,
      totalGst: 102.09,
      finalAmount: 952.84,
    })
  })

  it('removes intra-state GST from an inclusive amount', () => {
    const result = calculateGst({
      mode: 'remove',
      supplyType: 'intra-state',
      amount: 1_180,
      rate: 18,
    })

    expect(result).toMatchObject({
      taxableValue: 1_000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      totalGst: 180,
      inclusiveAmount: 1_180,
    })
  })

  it('removes inter-state GST and reports IGST only', () => {
    const result = calculateGst({
      mode: 'remove',
      supplyType: 'inter-state',
      amount: 1_120,
      rate: 12,
    })

    expect(result).toMatchObject({
      taxableValue: 1_000,
      cgst: 0,
      sgst: 0,
      igst: 120,
      totalGst: 120,
      inclusiveAmount: 1_120,
    })
  })

  it.each(STANDARD_GST_RATES)(
    'calculates the standard $label rate from the central registry',
    ({ rate }) => {
      const result = calculateGst({ ...intraStateAdd, amount: 1_000, rate })
      expect(result.totalGst).toBe(roundCurrency((1_000 * rate) / 100))
      expect(result.cgst + result.sgst).toBe(result.totalGst)
    },
  )

  it('supports a non-standard custom rate', () => {
    const result = calculateGst({ ...intraStateAdd, amount: 2_000, rate: 7.5 })
    expect(result).toMatchObject({ totalGst: 150, cgst: 75, sgst: 75, finalAmount: 2_150 })
  })

  it('rounds currency half-up and keeps split totals exact to one paise', () => {
    expect(roundCurrency(100.005)).toBe(100.01)

    const result = calculateGst({ ...intraStateAdd, amount: 0.1, rate: 5 })
    expect(result.totalGst).toBe(0.01)
    expect(result.cgst).toBe(0)
    expect(result.sgst).toBe(0.01)
    expect(result.cgst + result.sgst).toBe(result.totalGst)
    expect(result.finalAmount).toBe(0.11)
  })

  it('keeps add and remove reversible within one-paise currency tolerance', () => {
    const amounts = [0, 0.03, 1.01, 99.99, 1_234.56, 98_765.43]
    const rates = [0, 0.25, 3, 5, 7.5, 12, 18, 28]

    for (const supplyType of Object.values(GST_SUPPLY_TYPES)) {
      for (const amount of amounts) {
        for (const rate of rates) {
          const added = calculateGst({ mode: 'add', supplyType, amount, rate })
          const removed = calculateGst({
            mode: 'remove',
            supplyType,
            amount: added.finalAmount,
            rate,
          })
          expect(Math.abs(removed.taxableValue - roundCurrency(amount))).toBeLessThanOrEqual(0.01)
          expect(removed.inclusiveAmount).toBe(added.finalAmount)
        }
      }
    }
  })

  it.each([
    [null, 'INVALID_INPUT'],
    [{ ...intraStateAdd, amount: '100', rate: 18 }, 'INVALID_AMOUNT'],
    [{ ...intraStateAdd, amount: -1, rate: 18 }, 'INVALID_AMOUNT'],
    [{ ...intraStateAdd, amount: Infinity, rate: 18 }, 'INVALID_AMOUNT'],
    [{ ...intraStateAdd, amount: 100, rate: '18' }, 'INVALID_RATE'],
    [{ ...intraStateAdd, amount: 100, rate: -1 }, 'INVALID_RATE'],
    [{ ...intraStateAdd, amount: 100, rate: 101 }, 'INVALID_RATE'],
    [{ ...intraStateAdd, mode: 'increase', amount: 100, rate: 18 }, 'INVALID_MODE'],
    [{ ...intraStateAdd, supplyType: 'local', amount: 100, rate: 18 }, 'INVALID_SUPPLY_TYPE'],
  ])('rejects invalid calculation input %#', (input, code) => {
    expectGstError(() => calculateGst(input), code)
  })
})

function expectGstError(callback, code) {
  try {
    callback()
  } catch (error) {
    expect(error).toBeInstanceOf(GstCalculationError)
    expect(error.code).toBe(code)
    return
  }
  throw new Error(`Expected GstCalculationError with code ${code}.`)
}
