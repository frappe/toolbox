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
    </header>

    <div class="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section class="min-w-0" aria-labelledby="converter-heading">
        <h2 id="converter-heading" class="sr-only">Convert units</h2>
        <div role="group" aria-label="Measurement category" class="flex flex-wrap gap-2">
          <Button
            v-for="category in converter.categories"
            :key="category.id"
            class="h-9"
            :label="category.name"
            :variant="converter.categoryId.value === category.id ? 'solid' : 'outline'"
            :aria-pressed="converter.categoryId.value === category.id"
            :data-category-id="category.id"
            @click="converter.setCategory(category.id)"
          />
        </div>

        <div class="mt-5 max-w-md rounded-2xl bg-surface-gray-1 p-3 sm:p-4">
          <p
            class="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="conversion-announcement"
          >
            {{ converter.conversionAnnouncement.value }}
          </p>
          <div class="grid min-w-0 grid-cols-1 gap-2">
            <ConversionField
              label="From"
              :model-value="converter.fromInput.value"
              :unit-id="converter.fromUnitId.value"
              :category-id="converter.categoryId.value"
              :invalid="converter.lastEditedSide.value === 'from' && Boolean(converter.errorMessage.value)"
              @update:model-value="converter.updateFromInput"
              @update:unit-id="converter.setFromUnit"
              @commit="converter.recordHistory()"
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
              @commit="converter.recordHistory()"
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

      <aside class="min-w-0 lg:sticky lg:top-6">
        <ToolHistory
          :entries="converter.historyEntries.value"
          :copied-entry-id="copiedHistoryId"
          list-label="Unit conversion history"
          clear-label="Clear unit history"
          empty-title="No conversions yet"
          empty-description="Converted values you copy or commit appear here."
          reuse-title="Reuse this conversion"
          @reuse="converter.reuseHistory"
          @copy="copyHistoryEntry"
          @remove="converter.removeHistory"
          @clear="converter.clearHistory"
        />
      </aside>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolHistory from '@/components/history/ToolHistory.vue'
import ConversionField from '@/tools/unit-converter/ConversionField.vue'
import { useUnitConverter } from '@/tools/unit-converter/useUnitConverter'

const converter = useUnitConverter()
const preferences = useToolboxPreferences()
const copiedHistoryId = ref('')

onMounted(() => preferences.recordRecent('unit-converter'))

async function copyHistoryEntry(entry) {
  try {
    await globalThis.navigator?.clipboard?.writeText(entry.value)
    copiedHistoryId.value = entry.id
  } catch {
    copiedHistoryId.value = ''
  }
}
</script>
