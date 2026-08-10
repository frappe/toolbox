import { computed, reactive, ref } from 'vue'
import { healthCalculators, healthCalculatorsById } from './catalog'
import { HealthCalculationError } from './errors'

// The height and weight a visitor types are the same height and weight in each of these, which is
// the reason the four share one view. Age and sex are shared for the same reason. What stays with
// one calculator is what belongs to it: the activity level, and everything the pace calculator
// holds. A calculator that does not carry a shared field is simply skipped.
const SHARED_INPUTS = ['unitSystem', 'height', 'weight', 'age', 'sex']

// `initialId` is the calculator the route asks for. Each calculator is its own tool at its own
// URL now, so which one is showing is decided before this is called rather than by a first click.
export function useHealthCalculators(initialId = healthCalculators[0].id) {
  const activeId = ref(healthCalculatorsById.has(initialId) ? initialId : healthCalculators[0].id)
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
    writeInput(id, String(value))
    if (id === 'unitSystem' && oldSystem !== value) convertBodyInputs(oldSystem, value)
    calculate()
  }

  function writeInput(id, value) {
    if (!SHARED_INPUTS.includes(id)) {
      activeValues.value[id] = value
      return
    }
    for (const values of Object.values(valuesById)) {
      if (Object.hasOwn(values, id)) values[id] = value
    }
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
    // Through the same path, so a reset of a shared measurement reaches the calculators that share
    // it. Resetting one and leaving the others holding the old height is worse than not sharing.
    for (const [id, value] of Object.entries(activeCalculator.value.defaults)) writeInput(id, value)
    calculate()
  }

  // Every calculator that holds a height holds it in the system now chosen. Converting only the
  // one on screen would leave the others reading imperial numbers under metric labels.
  function convertBodyInputs(from, to) {
    if (!from || !to || from === to) return
    for (const values of Object.values(valuesById)) {
      if (!Object.hasOwn(values, 'height')) continue
      if (to === 'imperial') {
        values.height = formatConverted(Number(values.height) / 2.54)
        values.weight = formatConverted(Number(values.weight) * 2.2046226218)
      } else {
        values.height = formatConverted(Number(values.height) * 2.54)
        values.weight = formatConverted(Number(values.weight) / 2.2046226218)
      }
    }
  }

  calculate()
  return { calculators: healthCalculators, activeId, activeCalculator, activeInputs, activeValues, presentation, errorMessage, selectCalculator, updateInput, calculate, reset }
}

function formatConverted(value) { return Number.isFinite(value) ? String(Number(value.toFixed(4))) : '' }
