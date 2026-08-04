import { computed, ref } from 'vue'

import { useToolHistory } from '@/composables/useToolHistory'
import {
  calculateGst,
  createGstCopySummary,
  formatGstCopySummary,
  getStandardGstRate,
  GST_MODES,
  GST_SUPPLY_TYPES,
  GstCalculationError,
  parseGstRateHandoff,
  STANDARD_GST_RATES,
} from './index'

export const CUSTOM_RATE_ID = 'custom'
export const DEFAULT_GST_RATE_ID = 'eighteen'

export function useGstCalculator(options = {}) {
  const history = options.history ?? useToolHistory('gst-calculator')
  const mode = ref(GST_MODES.ADD)
  const supplyType = ref(GST_SUPPLY_TYPES.INTRA_STATE)
  const amountInput = ref('')
  const selectedRateId = ref(DEFAULT_GST_RATE_ID)
  const customRateInput = ref('')
  const result = ref(null)
  const errorMessage = ref('')
  const inputHint = ref('')
  const resultAnnouncement = ref('')
  const copyStatus = ref('')
  const handoffApplied = ref(applyInitialRate(options.initialRate))

  const amountLabel = computed(() =>
    mode.value === GST_MODES.ADD ? 'Base amount' : 'GST-inclusive amount',
  )
  const finalAmountLabel = computed(() =>
    mode.value === GST_MODES.ADD ? 'Final amount' : 'Inclusive amount',
  )
  const canCopy = computed(() => Boolean(result.value))

  function setMode(nextMode) {
    if (!Object.values(GST_MODES).includes(nextMode)) return
    mode.value = nextMode
    recalculate()
  }

  function setSupplyType(nextSupplyType) {
    if (!Object.values(GST_SUPPLY_TYPES).includes(nextSupplyType)) return
    supplyType.value = nextSupplyType
    recalculate()
  }

  function updateAmount(value) {
    amountInput.value = String(value)
    recalculate()
  }

  function selectRate(rateId) {
    if (rateId !== CUSTOM_RATE_ID && !getStandardGstRate(rateId)) return
    selectedRateId.value = rateId
    handoffApplied.value = false
    recalculate()
  }

  function updateCustomRate(value) {
    customRateInput.value = String(value)
    selectedRateId.value = CUSTOM_RATE_ID
    handoffApplied.value = false
    recalculate()
  }

  function clear() {
    amountInput.value = ''
    result.value = null
    clearFeedback()
  }

  function reset() {
    mode.value = GST_MODES.ADD
    supplyType.value = GST_SUPPLY_TYPES.INTRA_STATE
    amountInput.value = ''
    selectedRateId.value = DEFAULT_GST_RATE_ID
    customRateInput.value = ''
    result.value = null
    handoffApplied.value = false
    clearFeedback()
  }

  async function copyResult(clipboard = globalThis.navigator?.clipboard) {
    if (!result.value) return false

    try {
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable')
      const summary = createGstCopySummary(result.value)
      await clipboard.writeText(formatGstCopySummary(summary))
      copyStatus.value = 'GST summary copied.'
      recordHistory()
      return true
    } catch {
      copyStatus.value = 'Copy is unavailable in this browser.'
      return false
    }
  }

  // Record the current GST result. De-dupes against the last row so recording on both the
  // amount-commit and a copy of the same calculation never doubles an entry.
  function recordHistory() {
    const current = result.value
    if (!current) return

    const verb = current.mode === GST_MODES.ADD ? 'added' : 'removed'
    history.add({
      label: `${formatInr(current.inputAmount)} · ${current.rate}% ${verb}`,
      value: formatInr(current.finalAmount),
      payload: {
        mode: mode.value,
        supplyType: supplyType.value,
        selectedRateId: selectedRateId.value,
        customRateInput: customRateInput.value,
        amountInput: amountInput.value,
      },
    })
  }

  function reuseHistory(entry) {
    const payload = entry?.payload
    if (!payload) return

    if (Object.values(GST_MODES).includes(payload.mode)) mode.value = payload.mode
    if (Object.values(GST_SUPPLY_TYPES).includes(payload.supplyType)) {
      supplyType.value = payload.supplyType
    }
    selectedRateId.value = payload.selectedRateId ?? DEFAULT_GST_RATE_ID
    customRateInput.value = String(payload.customRateInput ?? '')
    amountInput.value = String(payload.amountInput ?? '')
    handoffApplied.value = false
    recalculate()
  }

  function recalculate() {
    result.value = null
    clearFeedback()

    const rateState = resolveRate()
    if (rateState.kind !== 'valid') {
      applyInputState(rateState, 'Enter a valid GST rate.')
      return
    }

    const amountState = parseGstDecimalInput(amountInput.value)
    if (amountState.kind === 'empty') return
    if (amountState.kind !== 'valid') {
      applyInputState(amountState, 'Enter a valid amount.')
      return
    }

    try {
      result.value = calculateGst({
        mode: mode.value,
        supplyType: supplyType.value,
        amount: amountState.value,
        rate: rateState.value,
      })
      resultAnnouncement.value = buildResultAnnouncement(result.value)
    } catch (error) {
      errorMessage.value =
        error instanceof GstCalculationError
          ? error.message
          : 'The GST calculation could not be completed.'
    }
  }

  function resolveRate() {
    const standardRate = getStandardGstRate(selectedRateId.value)
    if (standardRate) return { kind: 'valid', value: standardRate.rate }

    return parseGstDecimalInput(customRateInput.value)
  }

  function applyInputState(state, invalidMessage) {
    if (state.kind === 'empty') {
      inputHint.value = 'Enter a custom GST rate to continue.'
    } else if (state.kind === 'partial') {
      inputHint.value = 'Finish entering the number to calculate GST.'
    } else {
      errorMessage.value = invalidMessage
    }
  }

  function applyInitialRate(value) {
    const rate = parseGstRateHandoff(value)
    if (rate === null) return false

    const standardRate = STANDARD_GST_RATES.find((entry) => entry.rate === rate)
    if (standardRate) {
      selectedRateId.value = standardRate.id
    } else {
      selectedRateId.value = CUSTOM_RATE_ID
      customRateInput.value = String(rate)
    }
    return true
  }

  function clearFeedback() {
    errorMessage.value = ''
    inputHint.value = ''
    resultAnnouncement.value = ''
    copyStatus.value = ''
  }

  return {
    mode,
    supplyType,
    amountInput,
    amountLabel,
    selectedRateId,
    customRateInput,
    result,
    errorMessage,
    inputHint,
    resultAnnouncement,
    copyStatus,
    handoffApplied,
    finalAmountLabel,
    canCopy,
    historyEntries: history.entries,
    recordHistory,
    reuseHistory,
    removeHistory: history.remove,
    clearHistory: history.clear,
    setMode,
    setSupplyType,
    updateAmount,
    selectRate,
    updateCustomRate,
    clear,
    reset,
    copyResult,
  }
}

export function parseGstDecimalInput(input) {
  const value = String(input).trim()
  if (!value) return { kind: 'empty' }
  if (/^[+-]?\.?$/.test(value)) return { kind: 'partial' }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)) return { kind: 'invalid' }

  const number = Number(value)
  return Number.isFinite(number) ? { kind: 'valid', value: number } : { kind: 'invalid' }
}

export function formatInr(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function buildResultAnnouncement(result) {
  const finalLabel = result.mode === GST_MODES.ADD ? 'Final amount' : 'Inclusive amount'
  return `GST updated. Total GST: INR ${result.totalGst.toFixed(2)}. ${finalLabel}: INR ${result.inclusiveAmount.toFixed(2)}.`
}
