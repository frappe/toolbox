import { computed, ref, watch } from 'vue'

import { fetchRateHistory } from './rateHistory'

// Drives the rate chart: tracks the selected range, loads the real ECB series for the
// current pair, and caches per pair+range so switching back is instant.
export function useRateChart({ base, quote, fetcher = fetchRateHistory, defaultRange = '1Y' } = {}) {
  const range = ref(defaultRange)
  const series = ref(null)
  const state = ref('idle') // idle | loading | ready | empty | error | unsupported
  const errorMessage = ref('')
  const cache = new Map()
  let requestToken = 0

  const canChart = computed(() =>
    Boolean(base.value && quote.value && base.value !== quote.value),
  )

  async function load() {
    if (!canChart.value) {
      series.value = null
      state.value = 'unsupported'
      return
    }

    const key = `${base.value}:${quote.value}:${range.value}`
    if (cache.has(key)) {
      series.value = cache.get(key)
      state.value = seriesState(cache.get(key))
      return
    }

    const token = (requestToken += 1)
    state.value = 'loading'
    errorMessage.value = ''
    try {
      const data = await fetcher(base.value, quote.value, range.value)
      if (token !== requestToken) return // a newer request superseded this one
      cache.set(key, data)
      series.value = data
      state.value = seriesState(data)
    } catch {
      if (token !== requestToken) return
      series.value = null
      state.value = 'error'
      errorMessage.value = 'Historical rates are unavailable right now.'
    }
  }

  function setRange(next) {
    if (next === range.value) return
    range.value = next
    load()
  }

  function retry() {
    load()
  }

  // Reload when the currency pair changes; the per-key cache keeps revisits instant.
  watch([base, quote], () => load())

  return { range, series, state, errorMessage, canChart, load, setRange, retry }
}

function seriesState(data) {
  return data && data.points.length > 1 ? 'ready' : 'empty'
}
