import { ref } from 'vue'

import { getCategory, getUnit } from './registry'

export const RECENT_PAIRS_STORAGE_KEY = 'toolbox.unit-converter.recent-pairs.v1'
export const MAX_RECENT_PAIRS = 6

export function useRecentUnitPairs(storage = getBrowserStorage()) {
  const pairs = ref(readRecentPairs(storage))

  function record(pair) {
    const normalizedPair = normalizePair(pair)
    if (!normalizedPair) return

    const nextPairs = addRecentPair(pairs.value, normalizedPair)
    if (samePairOrder(nextPairs, pairs.value)) return

    pairs.value = nextPairs
    writeRecentPairs(storage, nextPairs)
  }

  function clear() {
    pairs.value = []
    removeStoredPairs(storage)
  }

  return { pairs, record, clear }
}

export function readRecentPairs(storage = getBrowserStorage()) {
  try {
    const storedValue = storage?.getItem(RECENT_PAIRS_STORAGE_KEY)
    if (!storedValue) return []

    const parsedValue = JSON.parse(storedValue)
    if (!Array.isArray(parsedValue)) return []

    return parsedValue
      .map(normalizePair)
      .filter(Boolean)
      .reduceRight(addRecentPair, [])
      .slice(0, MAX_RECENT_PAIRS)
  } catch {
    return []
  }
}

export function addRecentPair(currentPairs, pair) {
  const pairKey = unorderedPairKey(pair)
  const remainingPairs = currentPairs.filter((entry) => unorderedPairKey(entry) !== pairKey)
  return [pair, ...remainingPairs].slice(0, MAX_RECENT_PAIRS)
}

function normalizePair(pair) {
  if (!pair || typeof pair !== 'object') return null

  const category = getCategory(pair.categoryId)
  const fromUnit = getUnit(pair.fromUnitId)
  const toUnit = getUnit(pair.toUnitId)
  if (!category || fromUnit?.category !== category.id || toUnit?.category !== category.id) {
    return null
  }

  return {
    categoryId: category.id,
    fromUnitId: fromUnit.id,
    toUnitId: toUnit.id,
  }
}

function writeRecentPairs(storage, pairs) {
  try {
    storage?.setItem(RECENT_PAIRS_STORAGE_KEY, JSON.stringify(pairs))
  } catch {
    // Conversion remains available when browser storage is blocked or full.
  }
}

function removeStoredPairs(storage) {
  try {
    storage?.removeItem(RECENT_PAIRS_STORAGE_KEY)
  } catch {
    // The in-memory list can still be cleared.
  }
}

function unorderedPairKey(pair) {
  return `${pair.categoryId}:${[pair.fromUnitId, pair.toUnitId].sort().join(':')}`
}

function samePairOrder(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}
