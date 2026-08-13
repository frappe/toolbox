import { describe, expect, it, vi } from 'vitest'

import { useToolHistory } from '@/composables/useToolHistory'
import { GST_MODES, GST_SUPPLY_TYPES } from './index'
import {
  CUSTOM_RATE_ID,
  DEFAULT_GST_RATE_ID,
  formatInr,
  parseGstDecimalInput,
  useGstCalculator,
} from './useGstCalculator'

describe('GST calculator history', () => {
  it('records a result and reuses its full input state', () => {
    const calculator = useGstCalculator({ history: useToolHistory('gst-calculator', { storage: null }) })
    calculator.setSupplyType(GST_SUPPLY_TYPES.INTER_STATE)
    calculator.updateAmount('1000')
    calculator.recordHistory()
    // Recording the same result again must not duplicate the row.
    calculator.recordHistory()

    expect(calculator.historyEntries.value).toHaveLength(1)
    const [entry] = calculator.historyEntries.value
    expect(entry.label).toBe(`${formatInr(1000)} · 18% added`)
    expect(entry.value).toBe(formatInr(1180))
    expect(entry.payload).toMatchObject({ supplyType: GST_SUPPLY_TYPES.INTER_STATE, amountInput: '1000' })

    calculator.clear()
    calculator.setSupplyType(GST_SUPPLY_TYPES.INTRA_STATE)
    calculator.reuseHistory(entry)
    expect(calculator.amountInput.value).toBe('1000')
    expect(calculator.supplyType.value).toBe(GST_SUPPLY_TYPES.INTER_STATE)
    expect(calculator.result.value.finalAmount).toBe(1180)
  })
})

describe('GST calculator state', () => {
  it('starts in add, intra-state mode with the standard 18% rate', () => {
    const calculator = useGstCalculator()

    expect(calculator.mode.value).toBe(GST_MODES.ADD)
    expect(calculator.supplyType.value).toBe(GST_SUPPLY_TYPES.INTRA_STATE)
    expect(calculator.selectedRateId.value).toBe(DEFAULT_GST_RATE_ID)
    expect(calculator.amountLabel.value).toBe('Base amount')
    expect(calculator.result.value).toBeNull()
  })

  it('calculates add-mode intra-state GST immediately', () => {
    const calculator = useGstCalculator()
    calculator.updateAmount('1000')

    expect(calculator.result.value).toMatchObject({
      taxableValue: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      totalGst: 180,
      inclusiveAmount: 1180,
    })
    expect(calculator.resultAnnouncement.value).toBe(
      'GST updated. Total GST: INR 180.00. Final amount: INR 1180.00.',
    )
  })

  it('recalculates remove-mode inter-state GST', () => {
    const calculator = useGstCalculator()
    calculator.setMode(GST_MODES.REMOVE)
    calculator.setSupplyType(GST_SUPPLY_TYPES.INTER_STATE)
    calculator.updateAmount('1180')

    expect(calculator.amountLabel.value).toBe('GST-inclusive amount')
    expect(calculator.finalAmountLabel.value).toBe('Inclusive amount')
    expect(calculator.result.value).toMatchObject({
      taxableValue: 1000,
      cgst: 0,
      sgst: 0,
      igst: 180,
      totalGst: 180,
      inclusiveAmount: 1180,
    })
    expect(calculator.resultAnnouncement.value).toContain('Inclusive amount')
  })

  it('supports standard and custom rates', () => {
    const calculator = useGstCalculator()
    calculator.updateAmount('2000')
    calculator.selectRate('five')
    expect(calculator.result.value.totalGst).toBe(100)

    calculator.selectRate(CUSTOM_RATE_ID)
    expect(calculator.result.value).toBeNull()
    expect(calculator.inputHint.value).toContain('custom GST rate')

    calculator.updateCustomRate('7.5')
    expect(calculator.result.value.totalGst).toBe(150)
  })

  it('suppresses stale results for partial and invalid values', () => {
    const calculator = useGstCalculator()
    calculator.updateAmount('1000')

    calculator.updateAmount('-')
    expect(calculator.result.value).toBeNull()
    expect(calculator.inputHint.value).toContain('Finish entering')
    expect(calculator.resultAnnouncement.value).toBe('')

    calculator.updateAmount('invalid')
    expect(calculator.result.value).toBeNull()
    expect(calculator.errorMessage.value).toBe('Enter a valid amount.')
    expect(calculator.resultAnnouncement.value).toBe('')

    calculator.updateAmount('-1')
    expect(calculator.errorMessage.value).toContain('Amount must be from 0')
  })

  it('validates custom rate precision and range through the engine', () => {
    const calculator = useGstCalculator()
    calculator.updateAmount('100')
    calculator.selectRate(CUSTOM_RATE_ID)
    calculator.updateCustomRate('7.12345')
    expect(calculator.errorMessage.value).toContain('at most 4 decimal places')

    calculator.updateCustomRate('101')
    expect(calculator.errorMessage.value).toContain('from 0% to 100%')
  })

  it.each([
    ['18', 'eighteen', ''],
    ['7.5%', CUSTOM_RATE_ID, '7.5'],
  ])('accepts the safe HSN rate handoff %s', (initialRate, rateId, customRate) => {
    const calculator = useGstCalculator({ initialRate })

    expect(calculator.handoffApplied.value).toBe(true)
    expect(calculator.selectedRateId.value).toBe(rateId)
    expect(calculator.customRateInput.value).toBe(customRate)
  })

  it.each(['-5', '101', '18% extra', '<script>'])(
    'ignores the unsafe handoff %s',
    (initialRate) => {
      const calculator = useGstCalculator({ initialRate })

      expect(calculator.handoffApplied.value).toBe(false)
      expect(calculator.selectedRateId.value).toBe(DEFAULT_GST_RATE_ID)
    },
  )

  it('clears the amount without changing choices and resets all choices', () => {
    const calculator = useGstCalculator()
    calculator.setMode(GST_MODES.REMOVE)
    calculator.setSupplyType(GST_SUPPLY_TYPES.INTER_STATE)
    calculator.selectRate('five')
    calculator.updateAmount('105')

    calculator.clear()
    expect(calculator.amountInput.value).toBe('')
    expect(calculator.mode.value).toBe(GST_MODES.REMOVE)
    expect(calculator.selectedRateId.value).toBe('five')

    calculator.reset()
    expect(calculator.mode.value).toBe(GST_MODES.ADD)
    expect(calculator.supplyType.value).toBe(GST_SUPPLY_TYPES.INTRA_STATE)
    expect(calculator.selectedRateId.value).toBe(DEFAULT_GST_RATE_ID)
  })


})

describe('GST input and display helpers', () => {
  it.each(['', '  '])('parses %j as empty', (input) => {
    expect(parseGstDecimalInput(input).kind).toBe('empty')
  })

  it.each(['-', '+', '.', '-.'])('parses %s as partial', (input) => {
    expect(parseGstDecimalInput(input).kind).toBe('partial')
  })

  it.each(['0', '1000.50', '.25', '-1'])('parses %s as a finite decimal', (input) => {
    expect(parseGstDecimalInput(input).kind).toBe('valid')
  })

  it.each(['1,000', '12%', '1e3', 'Infinity'])('rejects %s', (input) => {
    expect(parseGstDecimalInput(input).kind).toBe('invalid')
  })

  it('formats Indian rupee values consistently', () => {
    expect(formatInr(123456.5)).toContain('1,23,456.50')
  })
})
