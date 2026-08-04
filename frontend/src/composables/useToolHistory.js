import { ref } from 'vue'

// A shared, browser-local "recent results" log used by the calculators and converters.
// Each tool keeps its own list under a versioned key. History stays in this browser only:
// it is high-volume, high-churn, device-contextual data, so it deliberately does not sync
// into the 64 KB Toolbox User Preference record the way favourites and saved pairs do.
export const MAX_TOOL_HISTORY_ENTRIES = 50
const MAX_LABEL_LENGTH = 512
const MAX_VALUE_LENGTH = 200
const MAX_PAYLOAD_BYTES = 2048

export function toolHistoryStorageKey(toolId) {
  return `toolbox:history:${toolId}:v1`
}

let sequence = 0

export function useToolHistory(
  toolId,
  {
    storage = getBrowserStorage(),
    storageKey = toolHistoryStorageKey(toolId),
    max = MAX_TOOL_HISTORY_ENTRIES,
    now = () => Date.now(),
  } = {},
) {
  const entries = ref(loadEntries(storage, storageKey, max))

  function add({ label, value, payload } = {}) {
    const normalizedLabel = String(label ?? '').trim()
    const normalizedValue = String(value ?? '').trim()
    if (!normalizedLabel || !normalizedValue) return null
    if (normalizedLabel.length > MAX_LABEL_LENGTH || normalizedValue.length > MAX_VALUE_LENGTH) {
      return null
    }

    // Skip immediate duplicates so recording on both "settle" and "copy" of the same
    // result does not create two identical rows.
    const latest = entries.value[0]
    if (latest && latest.label === normalizedLabel && latest.value === normalizedValue) {
      return latest
    }

    const at = now()
    const entry = {
      id: `history-${at}-${(sequence += 1)}`,
      label: normalizedLabel,
      value: normalizedValue,
      timestamp: at,
    }
    const safePayload = normalizePayload(payload)
    if (safePayload !== undefined) entry.payload = safePayload

    entries.value = [entry, ...entries.value].slice(0, max)
    persist(storage, storageKey, entries.value)
    return entry
  }

  function remove(id) {
    entries.value = entries.value.filter((entry) => entry.id !== id)
    persist(storage, storageKey, entries.value)
  }

  function clear() {
    entries.value = []
    persist(storage, storageKey, entries.value)
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

function loadEntries(storage, storageKey, max) {
  if (!storage) return []

  try {
    const storedValue = JSON.parse(storage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(storedValue)) return []
    return storedValue.filter(isValidEntry).slice(0, max)
  } catch {
    return []
  }
}

function isValidEntry(entry) {
  return Boolean(
    entry &&
      typeof entry.id === 'string' &&
      typeof entry.label === 'string' &&
      entry.label.length <= MAX_LABEL_LENGTH &&
      typeof entry.value === 'string' &&
      entry.value.length <= MAX_VALUE_LENGTH &&
      (entry.timestamp === undefined || Number.isFinite(entry.timestamp)),
  )
}

function normalizePayload(payload) {
  if (payload === undefined || payload === null) return undefined
  if (typeof payload !== 'object' || Array.isArray(payload)) return undefined

  try {
    const serialized = JSON.stringify(payload)
    if (!serialized || serialized.length > MAX_PAYLOAD_BYTES) return undefined
    return JSON.parse(serialized)
  } catch {
    return undefined
  }
}

function persist(storage, storageKey, entries) {
  if (!storage) return

  try {
    storage.setItem(storageKey, JSON.stringify(entries))
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
}
