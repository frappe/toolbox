import { describe, expect, it, vi } from 'vitest'

import { useToolHistory } from '@/composables/useToolHistory'
import {
  DEFAULT_CATEGORY_ID,
  DEFAULT_UNIT_PAIRS,
  formatConvertedValue,
  parseEditableNumber,
  useUnitConverter,
} from './useUnitConverter'

describe('unit converter state', () => {
  it('starts with the length defaults and empty fields', () => {
    const converter = useUnitConverter()

    expect(converter.categoryId.value).toBe(DEFAULT_CATEGORY_ID)
    expect(converter.fromUnitId.value).toBe(DEFAULT_UNIT_PAIRS.length.fromUnitId)
    expect(converter.toUnitId.value).toBe(DEFAULT_UNIT_PAIRS.length.toUnitId)
    expect(converter.fromInput.value).toBe('')
    expect(converter.toInput.value).toBe('')
  })

  it('converts immediately in either direction', () => {
    const converter = useUnitConverter()

    converter.updateFromInput('1000')
    expect(converter.toInput.value).toBe('1')
    expect(converter.conversionAnnouncement.value).toBe(
      'Converted value: 1. Unit: kilometer.',
    )

    converter.updateToInput('2.5')
    expect(converter.fromInput.value).toBe('2500')
    expect(converter.conversionAnnouncement.value).toBe(
      'Converted value: 2500. Unit: meter.',
    )
  })

  it('does not corrupt the opposite field for partial or invalid edits', () => {
    const converter = useUnitConverter()
    converter.updateFromInput('1000')

    converter.updateFromInput('-')
    expect(converter.toInput.value).toBe('1')
    expect(converter.inputHint.value).toContain('Finish entering')
    expect(converter.errorMessage.value).toBe('')
    expect(converter.conversionAnnouncement.value).toBe('')

    converter.updateFromInput('not a number')
    expect(converter.toInput.value).toBe('1')
    expect(converter.errorMessage.value).toContain('valid, finite')
    expect(converter.conversionAnnouncement.value).toBe('')

    converter.updateFromInput('2000')
    expect(converter.toInput.value).toBe('2')
    expect(converter.errorMessage.value).toBe('')
  })

  it('clears both fields when the active field becomes empty', () => {
    const converter = useUnitConverter()
    converter.updateFromInput('1000')
    converter.updateFromInput('')

    expect(converter.fromInput.value).toBe('')
    expect(converter.toInput.value).toBe('')
    expect(converter.conversionAnnouncement.value).toBe('')
  })

  it('recalculates after a unit changes', () => {
    const converter = useUnitConverter()
    converter.updateFromInput('1')
    converter.setToUnit('centimeter')

    expect(converter.toInput.value).toBe('100')
  })

  it('uses category-specific defaults and resets within the current measurement', () => {
    const converter = useUnitConverter()
    converter.setCategory('temperature')

    expect(converter.fromUnitId.value).toBe('celsius')
    expect(converter.toUnitId.value).toBe('fahrenheit')
    converter.updateFromInput('0')
    expect(converter.toInput.value).toBe('32')

    converter.setToUnit('kelvin')
    converter.reset()

    // Reset used to return to length. Each measurement is its own tool at its own URL now, so
    // moving to another one from a Reset button would leave the page and the URL disagreeing.
    expect(converter.categoryId.value).toBe('temperature')
    expect(converter.toUnitId.value).toBe('fahrenheit')
    expect(converter.fromInput.value).toBe('')
    expect(converter.toInput.value).toBe('')
  })

  it('starts on the measurement the route asks for, with its own units', () => {
    const converter = useUnitConverter({ initialCategoryId: 'temperature' })

    expect(converter.categoryId.value).toBe('temperature')
    // Setting the category alone would open /temperature-converter showing metres.
    expect(converter.fromUnitId.value).toBe('celsius')
    expect(converter.toUnitId.value).toBe('fahrenheit')
  })

  it('falls back to length for a measurement that does not exist', () => {
    const converter = useUnitConverter({ initialCategoryId: 'not-a-category' })

    expect(converter.categoryId.value).toBe('length')
    expect(converter.fromUnitId.value).toBe('meter')
  })

  it('swaps units and the displayed values', () => {
    const converter = useUnitConverter()
    converter.setToUnit('centimeter')
    converter.updateFromInput('1')
    converter.swap()

    expect(converter.fromUnitId.value).toBe('centimeter')
    expect(converter.toUnitId.value).toBe('meter')
    expect(converter.fromInput.value).toBe('100')
    expect(converter.toInput.value).toBe('1')
    expect(converter.derivedValue.value).toBe('1')
  })

  it('surfaces formula errors without replacing the previous result', () => {
    const converter = useUnitConverter()
    converter.setCategory('fuel-consumption')
    converter.updateFromInput('5')
    const previousResult = converter.toInput.value

    converter.updateFromInput('0')
    expect(converter.toInput.value).toBe(previousResult)
    expect(converter.errorMessage.value).toContain('undefined')
  })

  it('records a settled conversion in history and reuses its pair and value', () => {
    const converter = useUnitConverter({ history: useToolHistory('unit-converter', { storage: null }) })
    converter.setToUnit('foot')
    converter.updateFromInput('2')
    converter.recordHistory()
    // Re-committing the same conversion must not duplicate the row.
    converter.recordHistory()

    expect(converter.historyEntries.value).toHaveLength(1)
    const [entry] = converter.historyEntries.value
    expect(entry.label).toContain('2 m → ft')
    expect(entry.payload).toMatchObject({ categoryId: 'length', fromUnitId: 'meter', toUnitId: 'foot' })

    converter.setCategory('time')
    converter.reuseHistory(entry)
    expect(converter.categoryId.value).toBe('length')
    expect(converter.toUnitId.value).toBe('foot')
    expect(converter.fromInput.value).toBe('2')
  })


})

describe('editable number parsing and formatting', () => {
  it.each(['', '  '])('recognizes %j as empty', (input) => {
    expect(parseEditableNumber(input).kind).toBe('empty')
  })

  it.each(['-', '+', '.', '-.', '1e', '1e-', '1E+'])('recognizes %s as partial', (input) => {
    expect(parseEditableNumber(input).kind).toBe('partial')
  })

  it.each(['12', '-0.5', '.25', '1e3'])('recognizes %s as valid', (input) => {
    expect(parseEditableNumber(input).kind).toBe('valid')
  })

  it.each(['1,000', '12 px', 'Infinity', '1e999'])('recognizes %s as invalid', (input) => {
    expect(parseEditableNumber(input).kind).toBe('invalid')
  })

  it('formats useful precision without locale separators', () => {
    expect(formatConvertedValue(1 / 3)).toBe('0.333333333333')
    expect(formatConvertedValue(1e-12)).toBe('1e-12')
    expect(formatConvertedValue(-0)).toBe('0')
  })
})
