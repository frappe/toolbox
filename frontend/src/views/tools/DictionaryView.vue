<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      icon="lucide-book-open"
      :category="categoryName"
      title="Dictionary"
      description="Look up English definitions from the openly licensed WordNet dataset."
    />

    <form class="pt-8" role="search" @submit.prevent="dict.submit">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
        <SearchSelect
          class="min-w-0 flex-1"
          size="lg"
          variant="outline"
          spellcheck="false"
          label="Search a word"
          placeholder="serendipity, run, quiet"
          results-label="Word suggestions"
          :results="dict.suggestions.value"
          :model-value="dict.query.value"
          @update:model-value="dict.query.value = $event"
          @select="dict.selectWord($event)"
        >
          <template #option="{ result }">{{ result }}</template>
        </SearchSelect>
        <Button size="lg" class="sm:w-28" variant="solid" label="Look up" type="submit" :loading="dict.state.value === 'loading'" />
      </div>
    </form>

    <div class="pt-8" aria-live="polite">
      <section v-if="dict.state.value === 'ready'" aria-labelledby="dictionary-word-heading">
        <h2 id="dictionary-word-heading" class="text-2xl font-semibold text-ink-gray-9">{{ dict.word.value }}</h2>

        <div v-for="group in groupedSenses" :key="group.pos" class="pt-6">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-ink-gray-5">{{ group.label }}</h3>
          <ol class="mt-3 space-y-4">
            <li v-for="(sense, index) in group.senses" :key="index" class="flex gap-3">
              <span class="shrink-0 text-sm font-medium tabular-nums text-ink-gray-5">{{ index + 1 }}.</span>
              <div class="min-w-0">
                <p class="text-base leading-7 text-ink-gray-9">{{ sense.definition }}</p>
                <ul v-if="sense.examples?.length" class="mt-2 space-y-1 border-l-2 border-outline-gray-2 pl-3">
                  <li v-for="(example, exampleIndex) in sense.examples" :key="exampleIndex" class="text-sm italic leading-6 text-ink-gray-6">&ldquo;{{ example }}&rdquo;</li>
                </ul>
                <!-- Scoped to this meaning. The section below gathers every sense into one list,
                     and two headings reading "Synonyms" beside each other say nothing about the
                     difference between them. -->
                <div v-if="sense.synonyms?.length" class="flex flex-wrap items-center gap-2 pt-3">
                  <span class="text-xs font-medium text-ink-gray-5">In this sense</span>
                  <Button v-for="synonym in sense.synonyms" :key="synonym" variant="subtle" size="sm" :label="synonym" @click="dict.selectWord(synonym)" />
                </div>
              </div>
            </li>
          </ol>
        </div>

        <!-- One word input answers three questions. The meaning comes first, because this is a
             dictionary, and what else means it and what it is the opposite of follow, each
             gathered from every sense into one list. -->
        <div class="space-y-8 pt-8">
          <RelatedWordsSection
            heading="Synonyms"
            heading-id="dictionary-synonyms-heading"
            :groups="synonymGroups"
            empty-message="WordNet records no synonyms for this word."
            @select="dict.selectWord"
          />
          <RelatedWordsSection
            heading="Antonyms"
            heading-id="dictionary-antonyms-heading"
            :groups="antonymGroups"
            empty-message="WordNet records no antonyms for this word. Most words have none: an opposite is recorded between two particular words, not for every meaning."
            @select="dict.selectWord"
          />
        </div>

        <div v-if="activeSource" class="mt-8 border-t border-outline-gray-2 pt-5 text-xs leading-5 text-ink-gray-5">
          <a class="font-medium underline underline-offset-2" :href="activeSource.url" target="_blank" rel="noreferrer">{{ activeSource.attribution }}</a>
          <p v-if="activeSourceUpdatedAt" class="pt-1">Source updated {{ formatDate(activeSourceUpdatedAt) }}<span v-if="activeSource.license"> · {{ activeSource.license }}</span></p>
        </div>
      </section>

      <section v-else-if="dict.state.value === 'missing'" class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-6 text-center">
        <Icon name="lucide-search-x" class="mx-auto size-7 text-ink-gray-5" />
        <h2 class="pt-3 text-base font-semibold text-ink-gray-9">No exact match for &ldquo;{{ dict.word.value }}&rdquo;</h2>
        <p v-if="dict.missSuggestions.value.length" class="pt-1 text-sm leading-6 text-ink-gray-6">Did you mean one of these?</p>
        <p v-else class="pt-1 text-sm leading-6 text-ink-gray-6">Check the spelling and try another word.</p>
        <div v-if="dict.missSuggestions.value.length" class="flex flex-wrap justify-center gap-2 pt-4">
          <Button v-for="candidate in dict.missSuggestions.value" :key="candidate" variant="subtle" :label="candidate" @click="dict.selectWord(candidate)" />
        </div>
      </section>

      <section v-else-if="dict.state.value === 'unavailable'" class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center">
        <Icon name="lucide-database" class="mx-auto size-7 text-ink-gray-5" />
        <h2 class="pt-3 text-base font-semibold text-ink-gray-9">The dictionary dataset is not active yet</h2>
        <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">A validated WordNet release has not been activated on this site. Toolbox will not show definitions from an unverified dataset.</p>
      </section>

      <section v-else-if="dict.state.value === 'error'" class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center" role="alert">
        <Icon name="lucide-wifi-off" class="mx-auto size-7 text-ink-gray-5" />
        <h2 class="pt-3 text-base font-semibold text-ink-gray-9">This lookup needs an internet connection</h2>
        <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">{{ dict.errorMessage.value }}</p>
        <Button class="mt-4" label="Try again" @click="dict.submit" />
      </section>

      <section v-else-if="dict.state.value === 'loading'" class="flex min-h-40 flex-col items-center justify-center text-center">
        <LoadingIndicator class="size-6 text-ink-gray-5" />
        <p class="pt-3 text-sm text-ink-gray-6">Looking up &ldquo;{{ dict.query.value }}&rdquo;…</p>
      </section>

      <section v-else class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center">
        <Icon name="lucide-book-open" class="mx-auto size-7 text-ink-gray-5" />
        <h2 class="pt-3 text-base font-semibold text-ink-gray-8">Search for a word</h2>
        <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">Type a word and look it up to see what it means and what else means the same.</p>
      </section>
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { Button, Icon, LoadingIndicator } from 'frappe-ui'

import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import SearchSelect from '@/components/search/SearchSelect.vue'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import RelatedWordsSection from '@/tools/dictionary/RelatedWordsSection.vue'
import { byPartOfSpeech, partOfSpeechLabel } from '@/tools/dictionary/partsOfSpeech'
import { countRelatedWords, groupRelatedWords } from '@/tools/dictionary/relatedWords'
import { useDictionary } from '@/tools/dictionary/useDictionary'
import { getToolCategoryName } from '@/data/toolRegistry'

const categoryName = getToolCategoryName('dictionary')
const TOOL_ID = 'dictionary'

const preferences = useToolboxPreferences()
const dict = useDictionary()

// Group senses by part of speech, preserving sense order and a stable POS order.
const groupedSenses = computed(() => {
  const groups = new Map()
  for (const sense of dict.senses.value) {
    const pos = sense.pos || 'other'
    if (!groups.has(pos)) groups.set(pos, [])
    groups.get(pos).push(sense)
  }
  return [...groups.entries()]
    .map(([pos, senses]) => ({ pos, label: partOfSpeechLabel(pos), senses }))
    .sort(byPartOfSpeech)
})

// Both relations are recorded against one sense, so a word with thirteen senses answers the
// question thirteen times over with repeats. These are the two lists a visitor asked for.
const synonymGroups = computed(() => relatedGroups('synonyms'))
const antonymGroups = computed(() => relatedGroups('antonyms'))

const activeSource = computed(() => dict.source.value ?? dict.datasetStatus.value?.source ?? null)
const activeSourceUpdatedAt = computed(() => dict.sourceUpdatedAt.value || dict.datasetStatus.value?.sourceUpdatedAt || '')

const announcement = computed(() => {
  const state = dict.state.value
  if (state === 'loading') return `Looking up ${dict.query.value}.`
  if (state === 'ready') {
    const synonyms = countRelatedWords(synonymGroups.value)
    const antonyms = countRelatedWords(antonymGroups.value)
    // Most words have no antonym at all, and "0 antonyms" on every lookup is noise to somebody
    // who hears the whole line read out.
    const opposites = antonyms ? `, ${antonyms} antonyms` : ''
    return `${dict.word.value}: ${dict.senses.value.length} definitions, ${synonyms} synonyms${opposites}.`
  }
  if (state === 'missing') return `No exact match for ${dict.word.value}.`
  if (state === 'unavailable') return 'The dictionary dataset is not active.'
  if (state === 'error') return dict.errorMessage.value
  return ''
})

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  void dict.loadStatus()
})

function relatedGroups(field) {
  return groupRelatedWords(dict.senses.value, field, dict.word.value).sort(byPartOfSpeech)
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
</script>
