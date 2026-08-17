<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      :icon="tool.icon"
      :category="categoryName"
      :title="tool.name"
      :description="`${tool.description} It converts on your own device, and works offline.`"
    />

    <div class="pt-8">
      <section class="min-w-0" aria-labelledby="converter-heading">
        <h2 id="converter-heading" class="sr-only">Convert units</h2>
        <div class="rounded-2xl bg-surface-gray-1 p-4 sm:p-5">
          <p
            class="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="conversion-announcement"
          >
            {{ converter.conversionAnnouncement.value }}
          </p>
          <!--
            From and To read across, not down: a tool that goes from one unit to another is a
            sentence, and stacking it wasted the width the card now has (#282). The track
            definition is `ScriptConversionView`'s, so the two conversion tools line up rather
            than each inventing their own. `items-center` keeps the swap control on the axis of
            the two fields whatever height their labels take.
          -->
          <div class="grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
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
              icon="lucide-arrow-left-right"
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

          <Alert
            v-if="converter.errorMessage.value"
            class="mt-2"
            theme="red"
            :dismissible="false"
            :title="converter.errorMessage.value"
          >
            <template #footer>
              <Button size="md" label="Clear values" variant="ghost" @click="converter.clearValues" />
            </template>
          </Alert>
          <p v-else-if="converter.inputHint.value" class="px-3 pb-1 pt-3 text-sm text-ink-gray-5" aria-live="polite">
            {{ converter.inputHint.value }}
          </p>

          <div class="flex flex-wrap gap-2 px-2 pb-1 pt-4">
            <Button size="md" label="Clear" variant="subtle" @click="converter.clearValues" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { Alert, Button } from 'frappe-ui'

import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import ConversionField from '@/tools/unit-converter/ConversionField.vue'
import { useUnitConverter } from '@/tools/unit-converter/useUnitConverter'
import { getToolCategoryName } from '@/data/toolRegistry'

// Nine converters with nine routes, rendered here together because they share the conversion
// field: a value already typed survives a move between measurements.
const { tool, variant } = useToolFamily()
const categoryName = computed(() => getToolCategoryName(tool.value?.id))
const converter = useUnitConverter({ initialCategoryId: variant.value })
const preferences = useToolboxPreferences()

// A move between them does not remount this view, so both the measurement on show and the recent
// tool follow the route rather than the mount.
watch(variant, (categoryId) => converter.setCategory(categoryId))
watch(() => tool.value?.id, (toolId) => toolId && preferences.recordRecent(toolId), { immediate: true })
</script>
