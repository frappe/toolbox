import { ref, watch } from 'vue'

import { getDatasetStatus, lookup, suggest } from './api'

export const SUGGEST_MIN_LENGTH = 1
export const SUGGEST_DEBOUNCE_MS = 200

// State machine: idle -> loading -> ready | missing | unavailable | error.
// A network failure is reported honestly; the WordNet dataset lives on the server,
// so a lookup always needs a connection and is never fabricated offline.
export function useDictionary({
  lookupApi = lookup,
  suggestApi = suggest,
  statusApi = getDatasetStatus,
} = {}) {
  const query = ref('')
  const state = ref('idle')
  const word = ref('')
  const senses = ref([])
  const source = ref(null)
  const sourceUpdatedAt = ref('')
  const suggestions = ref([])
  const missSuggestions = ref([])
  const errorMessage = ref('')
  const datasetStatus = ref(null)

  let suggestTimer = null
  let suggestToken = 0
  let lookupToken = 0
  let lastLookedUp = ''

  // Debounced typeahead: fetch suggestions once the user pauses, never per keystroke,
  // and never for the word already on screen.
  watch(query, (value) => {
    clearTimeout(suggestTimer)
    const text = value.trim()
    if (text.length < SUGGEST_MIN_LENGTH || text.toLowerCase() === lastLookedUp) {
      suggestions.value = []
      return
    }
    suggestTimer = setTimeout(() => runSuggest(text), SUGGEST_DEBOUNCE_MS)
  })

  async function runSuggest(text) {
    const token = ++suggestToken
    try {
      const response = await suggestApi(text)
      if (token !== suggestToken) return
      suggestions.value = safeWords(response?.suggestions)
    } catch {
      // A typeahead failure stays silent; the submit path reports connection errors.
      if (token === suggestToken) suggestions.value = []
    }
  }

  function submit() {
    return lookupWord(query.value)
  }

  function selectWord(candidate) {
    const target = String(candidate ?? '').trim()
    if (!target) return Promise.resolve()
    lastLookedUp = target.toLowerCase()
    query.value = target
    return lookupWord(target)
  }

  async function lookupWord(rawWord) {
    const target = String(rawWord ?? '').trim()
    if (!target) return
    lastLookedUp = target.toLowerCase()
    clearTimeout(suggestTimer)
    suggestions.value = []
    state.value = 'loading'
    errorMessage.value = ''
    const token = ++lookupToken
    try {
      const response = await lookupApi(target)
      if (token !== lookupToken) return
      applyLookup(target, response)
    } catch {
      if (token !== lookupToken) return
      resetEntry()
      state.value = 'error'
      errorMessage.value =
        'This lookup needs an internet connection. The dictionary dataset is stored on the server.'
    }
  }

  function applyLookup(target, response) {
    if (response?.state === 'ready') {
      word.value = response.word || target
      senses.value = Array.isArray(response.senses) ? response.senses : []
      source.value = response.source ?? null
      sourceUpdatedAt.value = response.sourceUpdatedAt ?? ''
      missSuggestions.value = []
      state.value = 'ready'
      return
    }
    if (response?.state === 'missing') {
      word.value = response.word || target
      senses.value = []
      source.value = null
      sourceUpdatedAt.value = ''
      missSuggestions.value = safeWords(response.suggestions)
      state.value = 'missing'
      return
    }
    // 'unavailable' or any response without an active release.
    resetEntry()
    state.value = 'unavailable'
  }

  function resetEntry() {
    word.value = ''
    senses.value = []
    source.value = null
    sourceUpdatedAt.value = ''
    missSuggestions.value = []
  }

  async function loadStatus() {
    try {
      const response = await statusApi()
      datasetStatus.value = response?.dictionary ?? null
      if (!datasetStatus.value && state.value === 'idle') state.value = 'unavailable'
    } catch {
      // A failed status check is not proof the dataset is inactive; stay idle and let a
      // real search surface the honest connection error.
      datasetStatus.value = null
    }
  }

  return {
    query,
    state,
    word,
    senses,
    source,
    sourceUpdatedAt,
    suggestions,
    missSuggestions,
    errorMessage,
    datasetStatus,
    submit,
    selectWord,
    lookupWord,
    loadStatus,
  }
}

function safeWords(value) {
  return Array.isArray(value) ? value.filter((word) => typeof word === 'string' && word.trim()) : []
}
