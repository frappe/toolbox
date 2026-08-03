import { computed, ref } from 'vue'

import { fetchHsnStatus, searchHsn } from './api'

// Search runs on the server against the bundled HSN/SAC release; there is no client-side
// catalog snapshot. The tool needs no ERPNext or India Compliance install.
export function useHsnLookup({ statusFetcher = fetchHsnStatus, searcher = searchHsn } = {}) {
  const query = ref('')
  const results = ref([])
  const loading = ref(false)
  const searched = ref(false)
  const errorMessage = ref('')
  const status = ref(null)

  const metadata = computed(() => status.value?.hsn ?? null)
  const available = computed(() => Boolean(metadata.value))
  const source = computed(() => metadata.value?.source ?? null)
  const sourceUpdatedAt = computed(() => metadata.value?.sourceUpdatedAt ?? '')
  const recordCount = computed(() => metadata.value?.recordCount ?? 0)

  async function loadStatus() {
    try {
      status.value = await statusFetcher()
    } catch {
      status.value = null
    }
  }

  async function submit() {
    if (query.value.trim().length < 2) return
    loading.value = true
    errorMessage.value = ''
    try {
      const response = await searcher(query.value.trim())
      results.value = response.results ?? []
      searched.value = true
    } catch {
      errorMessage.value = 'The HSN and SAC search is unavailable. Try again.'
    } finally {
      loading.value = false
    }
  }

  return {
    query,
    results,
    loading,
    searched,
    errorMessage,
    available,
    source,
    sourceUpdatedAt,
    recordCount,
    loadStatus,
    submit,
  }
}
