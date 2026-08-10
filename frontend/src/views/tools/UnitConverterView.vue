<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon :name="tool.icon" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Convert</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          {{ tool.name }}
        </h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">
          {{ tool.description }} It converts on your own device, and works offline.
        </p>
      </div>
    </header>

    <div class="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section class="min-w-0" aria-labelledby="converter-heading">
        <h2 id="converter-heading" class="sr-only">Convert units</h2>
        <div class="overflow-x-auto">
          <ToolFamilyNav
            label="Measurement category"
            :links="siblingLinks"
            :current-route="currentRoute"
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

          <Alert
            v-if="converter.errorMessage.value"
            class="mt-2"
            theme="red"
            :dismissible="false"
            :title="converter.errorMessage.value"
          >
            <template #footer>
              <Button label="Clear values" variant="ghost" @click="converter.clearValues" />
            </template>
          </Alert>
          <p v-else-if="converter.inputHint.value" class="px-3 pb-1 pt-3 text-sm text-ink-gray-5" aria-live="polite">
            {{ converter.inputHint.value }}
          </p>

          <div class="flex flex-col gap-3 px-2 pb-1 pt-4 sm:flex-row sm:items-center">
            <div class="flex flex-wrap gap-2">
              <Button
                label="Copy result"
                variant="solid"
                icon-left="lucide-copy"
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
import { computed, ref, watch } from 'vue'
import { Alert, Button, Icon } from 'frappe-ui'

import ToolFamilyNav from '@/components/ToolFamilyNav.vue'
import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolHistory from '@/components/history/ToolHistory.vue'
import ConversionField from '@/tools/unit-converter/ConversionField.vue'
import { useUnitConverter } from '@/tools/unit-converter/useUnitConverter'

// Nine converters with nine routes, rendered here together because they share the conversion
// field and the recent-pairs list: a value already typed survives a move between measurements.
const { tool, variant, siblingLinks, currentRoute } = useToolFamily()
const converter = useUnitConverter({ initialCategoryId: variant.value })
const preferences = useToolboxPreferences()
const copiedHistoryId = ref('')

// A move between them does not remount this view, so both the measurement on show and the recent
// tool follow the route rather than the mount.
watch(variant, (categoryId) => converter.setCategory(categoryId))
watch(() => tool.value?.id, (toolId) => toolId && preferences.recordRecent(toolId), { immediate: true })

async function copyHistoryEntry(entry) {
  try {
    await globalThis.navigator?.clipboard?.writeText(entry.value)
    copiedHistoryId.value = entry.id
  } catch {
    copiedHistoryId.value = ''
  }
}
</script>
