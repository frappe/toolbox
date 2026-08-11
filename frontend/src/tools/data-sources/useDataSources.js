import { ref } from 'vue'

import { getDataSources } from './api'

// State machine: loading -> ready | error. The page has plenty to say without the server, so a
// failure hides the release facts and leaves the rest of the page standing.
export function useDataSources({ fetchSources = getDataSources } = {}) {
  const state = ref('loading')
  const datasets = ref([])

  async function load() {
    state.value = 'loading'
    try {
      const response = await fetchSources()
      datasets.value = Array.isArray(response?.datasets) ? response.datasets : []
      state.value = 'ready'
    } catch {
      datasets.value = []
      state.value = 'error'
    }
  }

  return { state, datasets, load }
}
