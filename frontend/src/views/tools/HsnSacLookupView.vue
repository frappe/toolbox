<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-search" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">India</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          HSN, SAC &amp; GST Lookup
        </h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">
          Search the India Compliance classification master with honest GST-rate availability.
        </p>
      </div>
      <Button
        class="h-11"
        variant="subtle"
        icon="lucide-star"
        :label="preferences.isFavourite('hsn-sac-lookup') ? 'Favourited' : 'Favourite'"
        @click="preferences.toggleFavourite('hsn-sac-lookup')"
      />
    </header>

    <ToolState
      v-if="!lookup.dependency.value"
      class="mt-8"
      status="loading"
      title="Checking India Compliance"
      message="Toolbox is checking the site dependency before enabling lookup."
    />

    <DependencyGate
      v-else-if="lookup.dependency.value.state !== 'ready'"
      v-model:install-confirmed="lookup.installConfirmed.value"
      class="mt-8"
      :dependency="lookup.dependency.value"
      :has-snapshot="Boolean(lookup.catalog.value)"
      @install="lookup.install"
      @retry="lookup.retry"
      @use-snapshot="lookup.useSavedSnapshot"
    />

    <ToolState
      v-else-if="!lookup.canSearch.value"
      class="mt-8"
      :status="lookup.loadState.value === 'error' ? 'error' : 'loading'"
      :title="lookup.loadState.value === 'error' ? 'HSN master unavailable' : 'Loading HSN master'"
      :message="lookup.errorMessage.value || 'Toolbox is preparing the searchable browser snapshot.'"
      :action-label="lookup.loadState.value === 'error' ? 'Try again' : ''"
      @action="lookup.refreshCatalog"
    />

    <div v-else class="grid gap-8 pt-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
      <aside class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 lg:sticky lg:top-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-ink-gray-9">Classification search</h2>
            <p class="pt-1 text-sm leading-6 text-ink-gray-6">The search runs in this browser.</p>
          </div>
          <Button
            label="Refresh snapshot"
            icon="lucide-refresh-cw"
            variant="ghost"
            :loading="lookup.loadState.value === 'refreshing'"
            @click="lookup.refreshCatalog"
          />
        </div>

        <label for="hsn-search" class="block pt-5 text-sm font-medium text-ink-gray-7">Code or description</label>
        <input
          id="hsn-search"
          v-model.trim="lookup.query.value"
          class="mt-2 h-12 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-base text-ink-gray-9"
          type="search"
          autocomplete="off"
          placeholder="Example: 0101 or live horses"
        />

        <p
          v-if="lookup.errorMessage.value"
          class="mt-4 rounded-lg bg-surface-amber-1 px-3 py-2 text-sm leading-6 text-ink-gray-7"
          role="status"
        >
          {{ lookup.errorMessage.value }}
        </p>

        <dl class="divide-y divide-outline-gray-2 pt-5">
          <div class="flex gap-3 py-3">
            <dt class="flex-1 text-sm text-ink-gray-6">Snapshot status</dt>
            <dd class="text-sm font-medium capitalize text-ink-gray-9">{{ statusLabel }}</dd>
          </div>
          <div class="flex gap-3 py-3">
            <dt class="flex-1 text-sm text-ink-gray-6">Records</dt>
            <dd class="text-sm font-medium tabular-nums text-ink-gray-9">{{ recordCount }}</dd>
          </div>
          <div class="flex gap-3 py-3">
            <dt class="flex-1 text-sm text-ink-gray-6">Source version</dt>
            <dd class="text-sm font-medium text-ink-gray-9">{{ lookup.catalog.value.sourceVersion }}</dd>
          </div>
          <div class="py-3">
            <dt class="text-sm text-ink-gray-6">Source changed</dt>
            <dd class="pt-1 text-sm text-ink-gray-8">{{ formatTimestamp(lookup.catalog.value.sourceModifiedAt) }}</dd>
          </div>
          <div class="py-3">
            <dt class="text-sm text-ink-gray-6">Browser snapshot saved</dt>
            <dd class="pt-1 text-sm text-ink-gray-8">{{ formatTimestamp(lookup.snapshotRefreshedAt.value) }}</dd>
          </div>
        </dl>

        <a
          class="inline-flex pt-4 text-sm font-medium text-ink-gray-8 underline underline-offset-4"
          :href="sourceUrl"
          target="_blank"
          rel="noreferrer"
        >Source: India Compliance</a>
      </aside>

      <div class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-base p-5 sm:p-6">
        <HsnResultList :query="lookup.query.value" :results="lookup.results.value" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { Button, Icon } from 'frappe-ui'

import ToolState from '@/components/states/ToolState.vue'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import DependencyGate from '@/tools/hsn-sac-lookup/DependencyGate.vue'
import HsnResultList from '@/tools/hsn-sac-lookup/HsnResultList.vue'
import { HSN_SOURCE_URL } from '@/tools/hsn-sac-lookup/snapshotStore'
import { useHsnLookup } from '@/tools/hsn-sac-lookup/useHsnLookup'

const preferences = useToolboxPreferences()
const lookup = useHsnLookup()
const sourceUrl = HSN_SOURCE_URL
const statusLabel = computed(() =>
  lookup.loadState.value === 'offline'
    ? 'offline snapshot'
    : lookup.loadState.value === 'stale'
      ? 'stale snapshot'
      : 'current snapshot',
)
const recordCount = computed(() => new Intl.NumberFormat().format(lookup.catalog.value?.recordCount ?? 0))

function formatTimestamp(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

onMounted(() => {
  preferences.recordRecent('hsn-sac-lookup')
  void lookup.initialize()
})
onBeforeUnmount(lookup.stopPolling)
</script>
