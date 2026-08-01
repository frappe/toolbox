<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-ruler" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Convert</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          Unit Converter
        </h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">
          Convert common measurements instantly. Everything works locally and offline.
        </p>
      </div>
      <Button
        variant="subtle"
        icon="lucide-star"
        :label="preferences.isFavourite('unit-converter') ? 'Favourited' : 'Favourite'"
        @click="preferences.toggleFavourite('unit-converter')"
      />
    </header>

    <section class="pt-8" aria-labelledby="converter-heading">
      <h2 id="converter-heading" class="sr-only">Convert units</h2>
      <div class="max-w-sm">
        <label for="unit-category" class="block text-sm font-medium text-ink-gray-7">Category</label>
        <select
          id="unit-category"
          :value="converter.categoryId.value"
          class="mt-2 h-11 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-8 outline-none focus:ring-2 focus:ring-outline-gray-3"
          @change="converter.setCategory($event.target.value)"
        >
          <option v-for="category in converter.categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>

      <div class="mt-5 rounded-2xl bg-surface-gray-1 p-2 sm:p-3">
        <p
          class="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="conversion-announcement"
        >
          {{ converter.conversionAnnouncement.value }}
        </p>
        <div class="grid min-w-0 grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]">
          <ConversionField
            label="From"
            :model-value="converter.fromInput.value"
            :unit-id="converter.fromUnitId.value"
            :category-id="converter.categoryId.value"
            :invalid="converter.lastEditedSide.value === 'from' && Boolean(converter.errorMessage.value)"
            @update:model-value="converter.updateFromInput"
            @update:unit-id="converter.setFromUnit"
          />

          <Button
            class="mx-auto"
            variant="subtle"
            icon="lucide-arrow-up-down"
            aria-label="Swap units"
            data-testid="swap-units"
            @click="converter.swap"
          />

          <ConversionField
            label="To"
            :model-value="converter.toInput.value"
            :unit-id="converter.toUnitId.value"
            :category-id="converter.categoryId.value"
            :invalid="converter.lastEditedSide.value === 'to' && Boolean(converter.errorMessage.value)"
            @update:model-value="converter.updateToInput"
            @update:unit-id="converter.setToUnit"
          />
        </div>

        <div
          v-if="converter.errorMessage.value"
          class="mt-2 flex flex-col gap-3 rounded-xl border border-outline-gray-2 bg-surface-base px-4 py-3 sm:flex-row sm:items-center"
          role="alert"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <Icon name="lucide-circle-alert" class="size-4 shrink-0 text-ink-gray-6" />
            <p class="text-sm text-ink-gray-7">{{ converter.errorMessage.value }}</p>
          </div>
          <Button label="Clear values" variant="ghost" @click="converter.clearValues" />
        </div>
        <p v-else-if="converter.inputHint.value" class="px-3 pb-1 pt-3 text-sm text-ink-gray-5" aria-live="polite">
          {{ converter.inputHint.value }}
        </p>

        <div class="flex flex-col gap-3 px-2 pb-1 pt-4 sm:flex-row sm:items-center">
          <div class="flex flex-wrap gap-2">
            <Button
              label="Copy result"
              variant="solid"
              icon="lucide-copy"
              :disabled="!converter.canCopy.value"
              @click="converter.copyResult()"
            />
            <Button label="Clear" variant="subtle" @click="converter.clearValues" />
            <Button label="Reset" variant="ghost" @click="converter.reset" />
          </div>
          <p
            v-if="converter.copyMessage.value"
            class="text-sm text-ink-gray-6 sm:ml-auto sm:text-right"
            role="status"
            aria-live="polite"
            data-testid="copy-status"
          >
            {{ converter.copyMessage.value }}
          </p>
        </div>
      </div>
    </section>

    <section v-if="converter.recentPairs.value.length" class="pt-10" aria-labelledby="recent-pairs-heading">
      <div class="flex items-center gap-3">
        <h2 id="recent-pairs-heading" class="text-base font-semibold text-ink-gray-9">Recent pairs</h2>
        <Button
          class="ml-auto"
          label="Clear recent"
          variant="ghost"
          @click="converter.clearRecentPairs"
        />
      </div>
      <div class="divide-y divide-outline-gray-2 pt-3">
        <button
          v-for="pair in converter.recentPairs.value"
          :key="`${pair.categoryId}:${pair.fromUnitId}:${pair.toUnitId}`"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left outline-none hover:bg-surface-gray-1 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          :aria-label="recentPairAriaLabel(pair)"
          @click="converter.useRecentPair(pair)"
        >
          <Icon name="lucide-history" class="size-4 shrink-0 text-ink-gray-5" />
          <span class="w-32 shrink-0 truncate text-sm text-ink-gray-5">
            {{ getCategory(pair.categoryId).name }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink-gray-8">
            {{ getUnit(pair.fromUnitId).symbol }}
            <span class="px-1 text-ink-gray-4" aria-hidden="true">→</span>
            {{ getUnit(pair.toUnitId).symbol }}
          </span>
          <Icon name="lucide-chevron-right" class="size-4 shrink-0 text-ink-gray-4" />
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ConversionField from '@/tools/unit-converter/ConversionField.vue'
import { getCategory, getUnit } from '@/tools/unit-converter/registry'
import { useUnitConverter } from '@/tools/unit-converter/useUnitConverter'

const converter = useUnitConverter()
const preferences = useToolboxPreferences()

onMounted(() => preferences.recordRecent('unit-converter'))

function recentPairAriaLabel(pair) {
  return `Use ${getUnit(pair.fromUnitId).name} to ${getUnit(pair.toUnitId).name}`
}
</script>
