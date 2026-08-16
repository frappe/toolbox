import { computed, reactive, ref } from 'vue'

import {
  calculateFinancialCalculator,
  createDefaultFinancialInputs,
  financialCalculators,
  financialCalculatorsById,
} from './catalog'
import { FinancialCalculationError } from './errors'

// `options.initialId` is the calculator the route asks for: each is its own tool at its own URL.
export function useFinancialCalculators(options = {}) {
  const activeId = ref(
    financialCalculatorsById.has(options.initialId) ? options.initialId : financialCalculators[0].id,
  )
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

  function clearFeedback() {
    errorMessage.value = ''
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
    resultAnnouncement,
    selectCalculator,
    updateInput,
    clear,
    reset,
  }
}
