import { computed, reactive, ref } from 'vue'
import { healthCalculators, healthCalculatorsById } from './catalog'
import { HealthCalculationError } from './errors'

export function useHealthCalculators() {
  const activeId = ref('bmi')
  const valuesById = reactive(Object.fromEntries(healthCalculators.map((item) => [item.id, { ...item.defaults }])))
  const result = ref(null)
  const errorMessage = ref('')
  const activeCalculator = computed(() => healthCalculatorsById.get(activeId.value))
  const activeValues = computed(() => valuesById[activeId.value])
  const activeInputs = computed(() => activeCalculator.value.inputs(activeValues.value))
  const presentation = computed(() => result.value ? activeCalculator.value.present(result.value, activeValues.value) : null)

  function selectCalculator(id) {
    if (!healthCalculatorsById.has(id)) return
    activeId.value = id
    calculate()
  }

  function updateInput(id, value) {
    if (!Object.hasOwn(activeValues.value, id)) return
    const oldSystem = id === 'unitSystem' ? activeValues.value.unitSystem : null
    activeValues.value[id] = String(value)
    if (id === 'unitSystem' && oldSystem !== value) convertBodyInputs(oldSystem, value)
    calculate()
  }

  function calculate() {
    errorMessage.value = ''
    result.value = null
    try {
      result.value = activeCalculator.value.calculate({ ...activeValues.value })
    } catch (error) {
      errorMessage.value = error instanceof HealthCalculationError ? error.message : 'The health estimate could not be calculated.'
    }
  }

  function reset() {
    Object.assign(activeValues.value, activeCalculator.value.defaults)
    calculate()
  }

  function convertBodyInputs(from, to) {
    if (!from || !to || from === to) return
    const values = activeValues.value
    if (to === 'imperial') {
      values.height = formatConverted(Number(values.height) / 2.54)
      values.weight = formatConverted(Number(values.weight) * 2.2046226218)
    } else {
      values.height = formatConverted(Number(values.height) * 2.54)
      values.weight = formatConverted(Number(values.weight) / 2.2046226218)
    }
  }

  calculate()
  return { calculators: healthCalculators, activeId, activeCalculator, activeInputs, activeValues, presentation, errorMessage, selectCalculator, updateInput, calculate, reset }
}

function formatConverted(value) { return Number.isFinite(value) ? String(Number(value.toFixed(4))) : '' }
