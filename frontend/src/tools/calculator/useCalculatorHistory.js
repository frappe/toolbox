import { ref } from 'vue'

export const CALCULATOR_HISTORY_KEY = 'toolbox:calculator-history:v1'
export const MAX_CALCULATOR_HISTORY_ENTRIES = 50

let nextHistoryId = 1

export function useCalculatorHistory({ storage = getBrowserStorage() } = {}) {
  const entries = ref(loadEntries(storage))

  function add(expression, result) {
    const entry = {
      id: `calculation-${Date.now()}-${nextHistoryId++}`,
      expression: String(expression).trim(),
      result: String(result),
      timestamp: Date.now(),
    }

    entries.value = [entry, ...entries.value].slice(0, MAX_CALCULATOR_HISTORY_ENTRIES)
    persist(storage, entries.value)
    return entry
  }

  function remove(id) {
    entries.value = entries.value.filter((entry) => entry.id !== id)
    persist(storage, entries.value)
  }

  function clear() {
    entries.value = []
    persist(storage, entries.value)
  }

  return { entries, add, remove, clear }
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function loadEntries(storage) {
  if (!storage) return []

  try {
    const storedValue = JSON.parse(storage.getItem(CALCULATOR_HISTORY_KEY) ?? '[]')
    if (!Array.isArray(storedValue)) return []
    return storedValue.filter(isValidEntry).slice(0, MAX_CALCULATOR_HISTORY_ENTRIES)
  } catch {
    return []
  }
}

function isValidEntry(entry) {
  return Boolean(
    entry
    && typeof entry.id === 'string'
    && typeof entry.expression === 'string'
    && entry.expression.length <= 4096
    && typeof entry.result === 'string'
    && entry.result.length <= 100,
  )
}

function persist(storage, entries) {
  if (!storage) return

  try {
    storage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
}
