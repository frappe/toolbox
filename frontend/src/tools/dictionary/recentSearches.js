export const DICTIONARY_RECENT_STORAGE_KEY = 'toolbox:dictionary-recent:v1'
export const MAX_RECENT_WORDS = 10
const MAX_WORD_LENGTH = 80

export function loadRecentSearches(storage = safeStorage()) {
  try {
    const parsed = JSON.parse(storage?.getItem(DICTIONARY_RECENT_STORAGE_KEY))
    return validRecentPayload(parsed) ? normalizeWords(parsed.words) : []
  } catch {
    return []
  }
}

export function saveRecentSearches(words, storage = safeStorage()) {
  const normalized = normalizeWords(words)
  try {
    storage?.setItem(DICTIONARY_RECENT_STORAGE_KEY, JSON.stringify({ version: 1, words: normalized }))
  } catch {
    // Storage can be unavailable in private browsing; recent words are best-effort.
  }
  return normalized
}

// Prepend the new word, then normalise so the freshest lookup wins its casing.
export function addRecentSearch(word, storage = safeStorage()) {
  return saveRecentSearches([word, ...loadRecentSearches(storage)], storage)
}

export function validRecentPayload(value) {
  return (
    isObject(value) &&
    value.version === 1 &&
    Array.isArray(value.words) &&
    value.words.every((word) => typeof word === 'string')
  )
}

function normalizeWords(words) {
  if (!Array.isArray(words)) return []
  const seen = new Set()
  const result = []
  for (const word of words) {
    if (typeof word !== 'string') continue
    const trimmed = word.trim()
    if (!trimmed || trimmed.length > MAX_WORD_LENGTH) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
    if (result.length === MAX_RECENT_WORDS) break
  }
  return result
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}
