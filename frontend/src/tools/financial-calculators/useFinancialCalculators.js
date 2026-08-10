import { computed, reactive, ref } from 'vue'

import { useToolHistory } from '@/composables/useToolHistory'
import {
  calculateFinancialCalculator,
  createDefaultFinancialInputs,
  financialCalculators,
  financialCalculatorsById,
} from './catalog'
import { FinancialCalculationError } from './errors'

// `options.initialId` is the calculator the route asks for: each is its own tool at its own URL.
export function useFinancialCalculators(options = {}) {
  // One history per calculator, because each one is its own tool. A single shared log would put
  // an EMI result on the SIP page, under a panel that says these are its recent results.
  const histories = Object.fromEntries(
    financialCalculators.map((calculator) => [
      calculator.id,
      options.history ?? useToolHistory(`financial-${calculator.id}`),
    ]),
  )
  const activeId = ref(
    financialCalculatorsById.has(options.initialId) ? options.initialId : financialCalculators[0].id,
  )
  const history = computed(() => histories[activeId.value])
  const inputValues = reactive(
    Object.fromEntries(
      financialCalculators.map((calculator) => [
        calculator.id,
        createDefaultFinancialInputs(calculator),
      ]),
    ),
  )
  const result = ref(null)
  const errorMessage = ref('')
  const copyStatus = ref('')
  const activeCalculator = computed(() => financialCalculatorsById.get(activeId.value))
  const activeInputs = computed(() => inputValues[activeId.value])
  const presentedResult = computed(() =>
    result.value ? activeCalculator.value.present(result.value) : null,
  )
  const resultAnnouncement = computed(() => {
    const primary = presentedResult.value?.primary
    return primary ? `${primary.label} updated.` : ''
  })

  function selectCalculator(calculatorId) {
    if (!financialCalculatorsById.has(calculatorId)) return
    activeId.value = calculatorId
    recalculate()
  }

  function updateInput(inputId, value) {
    if (!Object.hasOwn(activeInputs.value, inputId)) return
    activeInputs.value[inputId] = String(value)
    recalculate()
  }

  function clear() {
    for (const input of activeCalculator.value.inputs) activeInputs.value[input.id] = ''
    result.value = null
    clearFeedback()
  }

  function reset() {
    Object.assign(activeInputs.value, createDefaultFinancialInputs(activeCalculator.value))
    recalculate()
  }

  async function copyResult(summary, clipboard = globalThis.navigator?.clipboard) {
    if (!result.value || !summary) return false
    try {
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable')
      await clipboard.writeText(summary)
      copyStatus.value = 'Financial result copied.'
      return true
    } catch {
      copyStatus.value = 'Copy is unavailable in this browser.'
      return false
    }
  }

  function recalculate() {
    result.value = null
    clearFeedback()
    if (Object.values(activeInputs.value).every((value) => !String(value).trim())) return

    try {
      result.value = calculateFinancialCalculator(activeCalculator.value, activeInputs.value)
    } catch (error) {
      errorMessage.value =
        error instanceof FinancialCalculationError
          ? error.message
          : 'The financial calculation could not be completed.'
    }
  }

  // Record the current result. The view owns the number formatter (locale + precision), so it
  // is passed in. De-dupes against the last row.
  function recordHistory(formatValue) {
    const presentation = presentedResult.value
    if (!presentation || typeof formatValue !== 'function') return

    history.value.add({
      label: activeCalculator.value.name,
      value: formatValue(presentation.primary.value, presentation.primary.format),
      payload: { calculatorId: activeId.value, inputs: { ...activeInputs.value } },
    })
  }

  function reuseHistory(entry) {
    const payload = entry?.payload
    if (!payload || payload.calculatorId !== activeId.value) return

    const target = activeInputs.value
    for (const input of activeCalculator.value.inputs) {
      target[input.id] = String(payload.inputs?.[input.id] ?? '')
    }
    recalculate()
  }

  function clearFeedback() {
    errorMessage.value = ''
    copyStatus.value = ''
  }

  recalculate()

  return {
    calculators: financialCalculators,
    activeId,
    activeCalculator,
    activeInputs,
    result,
    presentedResult,
    errorMessage,
    copyStatus,
    resultAnnouncement,
    historyEntries: computed(() => history.value.entries.value),
    recordHistory,
    reuseHistory,
    removeHistory: (entryId) => history.value.remove(entryId),
    clearHistory: () => history.value.clear(),
    selectCalculator,
    updateInput,
    clear,
    reset,
    copyResult,
  }
}
