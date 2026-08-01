<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-building-2" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">India</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">India Business Lookup</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Validate a GSTIN locally. PIN and IFSC datasets are still being prepared.</p>
      </div>
      <Button class="h-11" variant="subtle" icon="lucide-star" :label="preferences.isFavourite(TOOL_ID) ? 'Favourited' : 'Favourite'" @click="preferences.toggleFavourite(TOOL_ID)" />
    </header>

    <div class="flex gap-2 overflow-x-auto pt-8" role="tablist" aria-label="Business lookup type">
      <button v-for="tab in tabs" :id="`${tab.id}-tab`" :key="tab.id" type="button" role="tab" class="h-10 shrink-0 rounded-lg px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" :class="activeTab === tab.id ? 'bg-surface-gray-7 text-ink-white' : 'bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3'" :aria-selected="activeTab === tab.id" :aria-controls="`${tab.id}-panel`" :tabindex="activeTab === tab.id ? 0 : -1" @click="selectTab(tab.id)" @keydown="handleTabKeydown($event, tab.id)">{{ tab.label }}</button>
    </div>

    <section v-if="activeTab === 'gstin'" id="gstin-panel" class="pt-8" role="tabpanel" aria-labelledby="gstin-tab">
      <div class="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <div>
          <label for="gstin" class="block text-sm font-medium text-ink-gray-7">GSTIN</label>
          <input id="gstin" v-model="input" class="mt-2 h-12 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 font-mono text-base uppercase tracking-wide text-ink-gray-9" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="24" placeholder="09AAAUP8175A1ZG" :aria-invalid="result.gstin && !result.valid ? 'true' : undefined" :aria-describedby="result.errors.length ? 'gstin-help gstin-errors' : 'gstin-help'" @blur="input = result.gstin" />
          <p id="gstin-help" class="pt-2 text-sm leading-6 text-ink-gray-5">Spaces are removed and letters are converted to uppercase. Nothing is sent to a server.</p>
        </div>

        <div class="min-w-0" aria-live="polite">
          <div v-if="!result.gstin" class="rounded-xl bg-surface-gray-1 px-5 py-6">
            <h2 class="text-base font-semibold text-ink-gray-8">Enter a GSTIN to check its format</h2>
            <p class="pt-1 text-sm leading-6 text-ink-gray-6">Toolbox checks its structure and checksum in this browser.</p>
          </div>
          <div v-else>
            <div class="flex items-center gap-3">
              <Icon :name="result.valid ? 'lucide-circle-check' : 'lucide-circle-x'" class="size-6 shrink-0" :class="result.valid ? 'text-ink-green-3' : 'text-ink-red-3'" />
              <h2 class="text-lg font-semibold text-ink-gray-9">{{ result.valid ? 'Structurally valid' : 'Invalid GSTIN format' }}</h2>
            </div>
            <ul v-if="result.errors.length" id="gstin-errors" class="space-y-2 pt-4 text-sm leading-6 text-ink-red-3" role="alert">
              <li v-for="error in result.errors" :key="error">{{ error }}</li>
            </ul>
            <dl class="divide-y divide-outline-gray-2 pt-5">
              <div class="flex gap-4 py-3"><dt class="w-40 shrink-0 text-sm text-ink-gray-6">State</dt><dd class="min-w-0 text-sm font-medium text-ink-gray-9">{{ result.state ? `${result.state} (${result.stateCode})` : 'Not recognised' }}</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 shrink-0 text-sm text-ink-gray-6">Embedded PAN</dt><dd class="font-mono text-sm font-medium text-ink-gray-9">{{ result.pan || '—' }}</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 shrink-0 text-sm text-ink-gray-6">Registration sequence</dt><dd class="font-mono text-sm font-medium text-ink-gray-9">{{ result.registrationSequence || '—' }}</dd></div>
              <div class="flex gap-4 py-3"><dt class="w-40 shrink-0 text-sm text-ink-gray-6">Checksum</dt><dd class="text-sm font-medium text-ink-gray-9">{{ checksumLabel }}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </section>

    <section v-else :id="`${activeTab}-panel`" class="pt-8" role="tabpanel" :aria-labelledby="`${activeTab}-tab`">
      <BusinessDatasetPanel :key="activeTab" :dataset-type="activeTab" :label="activeDataset.label" :metadata="datasetStatus?.[activeTab]" />
    </section>

    <p class="mt-8 border-t border-outline-gray-2 pt-5 text-sm leading-6 text-ink-gray-6">Format validation does not confirm that the registration is active or belongs to the claimed entity.</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import BusinessDatasetPanel from '@/tools/india-business-lookup/BusinessDatasetPanel.vue'
import { fetchDatasetStatus } from '@/tools/india-business-lookup/api'
import { validateGstin } from '@/tools/india-business-lookup/gstin'

const TOOL_ID = 'india-business-lookup'
const tabs = [{ id: 'gstin', label: 'GSTIN validator' }, { id: 'pin', label: 'PIN code' }, { id: 'ifsc', label: 'IFSC' }]
const preferences = useToolboxPreferences()
const activeTab = ref('gstin')
const input = ref('')
const datasetStatus = ref(null)
const result = computed(() => validateGstin(input.value))
const activeDataset = computed(() => tabs.find((tab) => tab.id === activeTab.value))
const checksumLabel = computed(() => {
  if (result.value.expectedChecksum === null) return 'Not checked'
  return result.value.checksumValid ? `Valid (${result.value.checksum})` : `Invalid (expected ${result.value.expectedChecksum})`
})

function selectTab(tabId) {
  activeTab.value = tabId
}

function handleTabKeydown(event, tabId) {
  const currentIndex = tabs.findIndex((tab) => tab.id === tabId)
  const targetIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? tabs.length - 1
      : event.key === 'ArrowRight'
        ? (currentIndex + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : null
  if (targetIndex === null) return

  event.preventDefault()
  selectTab(tabs[targetIndex].id)
  document.getElementById(`${tabs[targetIndex].id}-tab`)?.focus()
}

onMounted(async () => {
  preferences.recordRecent(TOOL_ID)
  try {
    datasetStatus.value = await fetchDatasetStatus()
  } catch {
    datasetStatus.value = null
  }
})
</script>
