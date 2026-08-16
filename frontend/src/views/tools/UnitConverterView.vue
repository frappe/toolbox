<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon :name="tool.icon" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">{{ categoryName }}</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          {{ tool.name }}
        </h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">
          {{ tool.description }} It converts on your own device, and works offline.
        </p>
      </div>
    </header>

    <div class="pt-8">
      <section class="min-w-0" aria-labelledby="converter-heading">
        <h2 id="converter-heading" class="sr-only">Convert units</h2>
        <div class="max-w-md rounded-2xl bg-surface-gray-1 p-3 sm:p-4">
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

          <div class="flex flex-wrap gap-2 px-2 pb-1 pt-4">
            <Button label="Clear" variant="subtle" @click="converter.clearValues" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { Alert, Button, Icon } from 'frappe-ui'

import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
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
