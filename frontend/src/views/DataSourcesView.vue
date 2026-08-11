<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
    <header>
      <p class="text-sm font-medium text-ink-gray-5">About</p>
      <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
        Where the data comes from
      </h1>
      <p class="pt-2 text-base leading-7 text-ink-gray-6">
        A tool is only as good as what it is built on. Every dataset and every service behind these
        tools is named here, with the licence it carries and the day the release in use was
        published.
      </p>
    </header>

    <section class="pt-10" aria-labelledby="data-sources-datasets">
      <h2 id="data-sources-datasets" class="text-lg font-semibold text-ink-gray-9">
        Datasets that ship with the site
      </h2>
      <p class="pt-2 text-base leading-7 text-ink-gray-7">
        Each of these is imported as a checksummed release and served from this site. Nothing is
        fetched from the publisher while you use a tool, so a lookup is as current as the release
        named below and no more.
      </p>

      <p v-if="sources.state.value === 'loading'" class="pt-6 text-sm text-ink-gray-5">
        Reading the release ledger…
      </p>
      <p v-else-if="sources.state.value === 'error'" class="pt-6 text-sm text-ink-gray-6">
        The release details need a connection, and this page could not reach the server. What each
        dataset is, and who publishes it, is below either way.
      </p>

      <div class="flex flex-col gap-4 pt-6">
        <article
          v-for="dataset in datasets"
          :key="dataset.datasetType"
          class="flex flex-col gap-3 rounded-xl bg-surface-gray-1 p-4 sm:p-5"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 class="text-base font-medium text-ink-gray-9">{{ dataset.name }}</h3>
            <p class="text-xs text-ink-gray-5">{{ dataset.tools.join(' · ') }}</p>
          </div>
          <p class="text-sm leading-6 text-ink-gray-7">{{ dataset.note }}</p>

          <dl v-if="dataset.active" class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div v-for="fact in dataset.facts" :key="fact.label" class="flex justify-between gap-3">
              <dt class="text-ink-gray-5">{{ fact.label }}</dt>
              <dd class="text-right font-medium tabular-nums text-ink-gray-8">{{ fact.value }}</dd>
            </div>
          </dl>
          <p v-else-if="sources.state.value === 'ready'" class="text-sm text-ink-gray-6">
            No release is active on this site, so the tool that reads it says so rather than
            answering from an unverified dataset.
          </p>

          <p v-if="dataset.source" class="text-xs leading-5 text-ink-gray-5">
            <a
              class="font-medium text-ink-gray-7 underline underline-offset-2"
              :href="dataset.source.url"
              target="_blank"
              rel="noreferrer"
              >{{ dataset.source.name }}</a
            >
            <span v-if="dataset.source.license"> · {{ dataset.source.license }}</span>
          </p>
        </article>
      </div>
    </section>

    <section class="pt-10" aria-labelledby="data-sources-live">
      <h2 id="data-sources-live" class="text-lg font-semibold text-ink-gray-9">
        Services called while you use a tool
      </h2>
      <p class="pt-2 text-base leading-7 text-ink-gray-7">
        Two tools ask somebody else for an answer. Both go through this site rather than from your
        browser, so the provider never sees you.
      </p>

      <div class="flex flex-col gap-4 pt-6">
        <article
          v-for="source in liveSources"
          :key="source.id"
          class="flex flex-col gap-3 rounded-xl bg-surface-gray-1 p-4 sm:p-5"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 class="text-base font-medium text-ink-gray-9">{{ source.name }}</h3>
            <p class="text-xs text-ink-gray-5">{{ source.tools.join(' · ') }}</p>
          </div>
          <p class="text-sm leading-6 text-ink-gray-7">{{ source.note }}</p>
          <p class="text-sm leading-6 text-ink-gray-7">
            <span class="text-ink-gray-5">Refresh</span> {{ source.refresh }}
          </p>
          <p class="text-xs leading-5 text-ink-gray-5">
            <a
              class="font-medium text-ink-gray-7 underline underline-offset-2"
              :href="source.url"
              target="_blank"
              rel="noreferrer"
              >{{ source.name }}</a
            >
            · {{ source.license }}
          </p>
        </article>
      </div>
    </section>

    <section class="pt-10" aria-labelledby="data-sources-local">
      <h2 id="data-sources-local" class="text-lg font-semibold text-ink-gray-9">
        Everything else needs no source
      </h2>
      <p class="pt-2 text-base leading-7 text-ink-gray-7">{{ LOCAL_TOOLS.note }}</p>
      <p class="pt-3 text-base leading-7 text-ink-gray-7">
        Toolbox has no accounts and keeps nothing about you. What you type into a tool stays in your
        browser, except where a lookup has to reach the server to answer, and those searches are not
        recorded.
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'

import { DATASET_NOTES, LIVE_SOURCES, LOCAL_TOOLS } from '@/tools/data-sources/catalog'
import { useDataSources } from '@/tools/data-sources/useDataSources'

const sources = useDataSources()
const liveSources = LIVE_SOURCES

// The server sends facts, and the catalog says what each dataset is. A dataset the server does not
// know about is still listed, because a page that quietly drops one says nothing about which.
const datasets = computed(() =>
  Object.entries(DATASET_NOTES).map(([datasetType, note]) => {
    const released = sources.datasets.value.find((entry) => entry.datasetType === datasetType)
    return {
      datasetType,
      ...note,
      active: Boolean(released?.active),
      source: released?.source ?? null,
      facts: released?.active ? facts(released) : [],
    }
  }),
)

function facts(release) {
  return [
    { label: 'Release', value: release.version },
    { label: 'Published', value: formatDate(release.sourceUpdatedAt) },
    { label: 'Rows', value: formatCount(release.recordCount) },
    { label: 'Imported', value: formatDate(release.importedAt) },
  ].filter((fact) => fact.value)
}

function formatCount(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : ''
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

onMounted(() => {
  void sources.load()
})
</script>
