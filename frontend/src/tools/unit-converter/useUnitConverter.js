import { computed, ref } from 'vue'

import { useToolHistory } from '@/composables/useToolHistory'
import { convert, UnitConversionError } from './converter'
import { conversionRegistry, getCategory, getUnit } from './registry'

export const DEFAULT_CATEGORY_ID = 'length'
export const DEFAULT_UNIT_PAIRS = Object.freeze({
  length: Object.freeze({ fromUnitId: 'meter', toUnitId: 'kilometer' }),
  area: Object.freeze({ fromUnitId: 'square-meter', toUnitId: 'square-foot' }),
  volume: Object.freeze({ fromUnitId: 'liter', toUnitId: 'us-gallon' }),
  mass: Object.freeze({ fromUnitId: 'kilogram', toUnitId: 'pound' }),
  temperature: Object.freeze({ fromUnitId: 'celsius', toUnitId: 'fahrenheit' }),
  speed: Object.freeze({ fromUnitId: 'kilometer-per-hour', toUnitId: 'mile-per-hour' }),
  time: Object.freeze({ fromUnitId: 'minute', toUnitId: 'hour' }),
  'digital-storage': Object.freeze({ fromUnitId: 'megabyte', toUnitId: 'gigabyte' }),
  'fuel-consumption': Object.freeze({
    fromUnitId: 'liter-per-100-kilometers',
    toUnitId: 'mile-per-us-gallon',
  }),
})

// `options.initialCategoryId` is the measurement the route asks for: each is its own tool at
// its own URL.
export function useUnitConverter(options = {}) {
  const history = options.history ?? useToolHistory('unit-converter')
  // The units have to start on the initial measurement's own pair, not on length's. Setting the
  // category alone would open /temperature-converter showing metres.
  const initialCategoryId = getCategory(options.initialCategoryId)?.id ?? DEFAULT_CATEGORY_ID
  const categoryId = ref(initialCategoryId)
  const fromUnitId = ref(DEFAULT_UNIT_PAIRS[initialCategoryId].fromUnitId)
  const toUnitId = ref(DEFAULT_UNIT_PAIRS[initialCategoryId].toUnitId)
  const fromInput = ref('')
  const toInput = ref('')
  const lastEditedSide = ref('from')
  const errorMessage = ref('')
  const inputHint = ref('')
  const conversionAnnouncement = ref('')

  const category = computed(() => getCategory(categoryId.value))
  const fromUnit = computed(() => getUnit(fromUnitId.value))
  const toUnit = computed(() => getUnit(toUnitId.value))
  // The derived side: the one the visitor did not type into. `recordHistory` and the announcement
  // both declare their own `resultUnit`, so these carry a different name rather than shadow.
  const derivedValue = computed(() =>
    lastEditedSide.value === 'from' ? toInput.value : fromInput.value,
  )
  const derivedUnit = computed(() =>
    lastEditedSide.value === 'from' ? toUnit.value : fromUnit.value,
  )
  const hasSettledConversion = computed(
    () => !errorMessage.value && parseEditableNumber(derivedValue.value).kind === 'valid',
  )

  function setCategory(nextCategoryId) {
    const defaults = DEFAULT_UNIT_PAIRS[nextCategoryId]
    if (!defaults) return

    categoryId.value = nextCategoryId
    fromUnitId.value = defaults.fromUnitId
    toUnitId.value = defaults.toUnitId
    clearValues()
  }

  function setFromUnit(nextUnitId) {
    setUnit('from', nextUnitId)
  }

  function setToUnit(nextUnitId) {
    setUnit('to', nextUnitId)
  }

  function updateFromInput(value) {
    fromInput.value = String(value)
    lastEditedSide.value = 'from'
    updateOppositeField('from')
  }

  function updateToInput(value) {
    toInput.value = String(value)
    lastEditedSide.value = 'to'
    updateOppositeField('to')
  }

  function swap() {
    ;[fromUnitId.value, toUnitId.value] = [toUnitId.value, fromUnitId.value]
    ;[fromInput.value, toInput.value] = [toInput.value, fromInput.value]
    lastEditedSide.value = 'from'
    updateOppositeField('from')
  }

  function clearValues() {
    fromInput.value = ''
    toInput.value = ''
    lastEditedSide.value = 'from'
    clearFeedback()
  }

  // Reset returns this converter to its own defaults. It does not move to another measurement,
  // because that would leave the page showing one thing and the URL naming another.
  function reset() {
    const defaults = DEFAULT_UNIT_PAIRS[categoryId.value]
    fromUnitId.value = defaults.fromUnitId
    toUnitId.value = defaults.toUnitId
    clearValues()
  }

  // Snapshot the current settled conversion into shared history. The source is the side the
  // user last edited; the result is the derived opposite side. De-duped against the last row.
  function recordHistory() {
    if (!hasSettledConversion.value) return
    const fromSide = lastEditedSide.value === 'from'
    const sourceRaw = fromSide ? fromInput.value : toInput.value
    const sourceUnit = fromSide ? fromUnit.value : toUnit.value
    const resultRaw = fromSide ? toInput.value : fromInput.value
    const resultUnit = fromSide ? toUnit.value : fromUnit.value
    if (parseEditableNumber(sourceRaw).kind !== 'valid') return

    history.add({
      label: `${sourceRaw} ${sourceUnit.symbol} → ${resultUnit.symbol}`,
      value: `${resultRaw} ${resultUnit.symbol}`,
      payload: {
        categoryId: categoryId.value,
        fromUnitId: fromUnitId.value,
        toUnitId: toUnitId.value,
        side: lastEditedSide.value,
        value: sourceRaw,
      },
    })
  }

  function reuseHistory(entry) {
    const payload = entry?.payload
    if (!payload) return

    const payloadCategory = getCategory(payload.categoryId)
    const payloadFromUnit = getUnit(payload.fromUnitId)
    const payloadToUnit = getUnit(payload.toUnitId)
    if (
      !payloadCategory ||
      payloadFromUnit?.category !== payloadCategory.id ||
      payloadToUnit?.category !== payloadCategory.id
    ) {
      return
    }

    categoryId.value = payloadCategory.id
    fromUnitId.value = payloadFromUnit.id
    toUnitId.value = payloadToUnit.id
    const side = payload.side === 'to' ? 'to' : 'from'
    if (side === 'from') updateFromInput(String(payload.value ?? ''))
    else updateToInput(String(payload.value ?? ''))
  }

  function setUnit(side, nextUnitId) {
    const nextUnit = getUnit(nextUnitId)
    if (nextUnit?.category !== categoryId.value) {
      errorMessage.value = 'Choose a unit from the selected category.'
      return
    }

    if (side === 'from') fromUnitId.value = nextUnit.id
    else toUnitId.value = nextUnit.id
    updateOppositeField(lastEditedSide.value)
  }

  function updateOppositeField(side) {
    clearFeedback()
    const activeInput = side === 'from' ? fromInput : toInput
    const oppositeInput = side === 'from' ? toInput : fromInput
    const parsedInput = parseEditableNumber(activeInput.value)

    if (parsedInput.kind === 'empty') {
      oppositeInput.value = ''
      return
    }
    if (parsedInput.kind === 'partial') {
      inputHint.value = 'Finish entering the number to update the conversion.'
      return
    }
    if (parsedInput.kind === 'invalid') {
      errorMessage.value = 'Enter a valid, finite number.'
      return
    }

    try {
      const result =
        side === 'from'
          ? convert(parsedInput.value, fromUnitId.value, toUnitId.value)
          : convert(parsedInput.value, toUnitId.value, fromUnitId.value)
      const formattedResult = formatConvertedValue(result)
      const resultUnit = side === 'from' ? toUnit.value : fromUnit.value
      oppositeInput.value = formattedResult
      conversionAnnouncement.value =
        `Converted value: ${formattedResult}. Unit: ${resultUnit.name.toLocaleLowerCase('en')}.`
    } catch (error) {
      errorMessage.value =
        error instanceof UnitConversionError
          ? error.message
          : 'The value could not be converted.'
    }
  }

  function clearFeedback() {
    errorMessage.value = ''
    inputHint.value = ''
    conversionAnnouncement.value = ''
  }

  return {
    categories: conversionRegistry,
    categoryId,
    category,
    fromUnitId,
    fromUnit,
    toUnitId,
    toUnit,
    fromInput,
    toInput,
    lastEditedSide,
    errorMessage,
    inputHint,
    conversionAnnouncement,
    derivedValue,
    derivedUnit,
    hasSettledConversion,
    historyEntries: history.entries,
    recordHistory,
    reuseHistory,
    removeHistory: history.remove,
    clearHistory: history.clear,
    setCategory,
    setFromUnit,
    setToUnit,
    updateFromInput,
    updateToInput,
    swap,
    clearValues,
    reset,
  }
}

export function parseEditableNumber(input) {
  const normalizedInput = String(input).trim()
  if (!normalizedInput) return { kind: 'empty' }
  if (/^[+-]?(?:\.?|(?:\d+\.?\d*|\.\d+)[eE][+-]?)$/.test(normalizedInput)) {
    return { kind: 'partial' }
  }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalizedInput)) {
    return { kind: 'invalid' }
  }

  const value = Number(normalizedInput)
  return Number.isFinite(value) ? { kind: 'valid', value } : { kind: 'invalid' }
}

export function formatConvertedValue(value) {
  if (Object.is(value, -0) || value === 0) return '0'

  const absoluteValue = Math.abs(value)
  if (absoluteValue >= 1e12 || absoluteValue < 1e-9) {
    const [mantissa, exponent] = value.toExponential(10).split('e')
    return `${mantissa.replace(/\.?0+$/, '')}e${exponent}`
  }

  return String(Number(value.toPrecision(12)))
}
