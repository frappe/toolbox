<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
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
          {{ tool.description }} Nothing you type is sent anywhere.
        </p>
      </div>
    </header>

    <div class="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <section
        class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6"
        :aria-labelledby="`${calculator.activeId.value}-inputs-heading`"
      >
        <div>
          <h2
            :id="`${calculator.activeId.value}-inputs-heading`"
            class="text-lg font-semibold text-ink-gray-9"
          >
            {{ calculator.activeCalculator.value.name }}
          </h2>
          <p class="pt-1 text-sm leading-6 text-ink-gray-6">
            {{ calculator.activeCalculator.value.description }}
          </p>
        </div>

        <div class="grid gap-5 pt-6 sm:grid-cols-2">
          <FinancialInput
            v-for="input in calculator.activeCalculator.value.inputs"
            :key="input.id"
            :input="input"
            :input-id="`${calculator.activeId.value}-${input.id}`"
            :model-value="calculator.activeInputs.value[input.id]"
            :currency="preferences.settings.defaultCurrency"
            :described-by="`${calculator.activeId.value}-feedback`"
            @update:model-value="calculator.updateInput(input.id, $event)"
            @commit="calculator.recordHistory(formatValue)"
          />
        </div>

        <div :id="`${calculator.activeId.value}-feedback`" class="pt-4">
          <ErrorMessage
            v-if="calculator.errorMessage.value"
            :message="calculator.errorMessage.value"
          />
          <p v-else class="text-sm leading-6 text-ink-gray-5">
            Rates use annual percentages. Inputs stay in this browser and are not saved.
          </p>
        </div>

        <div class="flex flex-wrap gap-2 pt-5">
          <Button class="h-11" label="Clear" variant="subtle" @click="calculator.clear" />
        </div>
      </section>

      <div class="flex flex-col gap-8 lg:sticky lg:top-6">
        <FinancialResults
          :presentation="calculator.presentedResult.value"
          :format-value="formatValue"
          :can-copy="Boolean(calculator.result.value)"
          @copy="copyResult"
        />
        <ToolHistory
          :entries="calculator.historyEntries.value"
          :copied-entry-id="copiedHistoryId"
          list-label="Financial calculation history"
          clear-label="Clear financial history"
          empty-title="No results yet"
          empty-description="Results you copy or commit appear here."
          reuse-title="Reuse these inputs"
          @reuse="calculator.reuseHistory"
          @copy="copyHistoryEntry"
          @remove="calculator.removeHistory"
          @clear="calculator.clearHistory"
        />
      </div>
    </div>

    <p class="sr-only" role="status" aria-live="polite" data-testid="financial-result-status">
      {{ calculator.resultAnnouncement.value }}
    </p>
    <p class="sr-only" role="status" aria-live="polite" data-testid="financial-copy-status">
      {{ calculator.copyStatus.value }}
    </p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Button, ErrorMessage, Icon } from 'frappe-ui'

import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolHistory from '@/components/history/ToolHistory.vue'
import FinancialInput from '@/tools/financial-calculators/FinancialInput.vue'
import FinancialResults from '@/tools/financial-calculators/FinancialResults.vue'
import { createFinancialFormatter } from '@/tools/financial-calculators/formatFinancialValue'
import { useFinancialCalculators } from '@/tools/financial-calculators/useFinancialCalculators'
import { getToolCategoryName } from '@/data/toolRegistry'

const preferences = useToolboxPreferences()
// Six calculators with six routes, rendered here together because they keep what was typed into
// each: a visitor can compare an EMI against a SIP without entering the numbers twice.
const { tool, variant } = useToolFamily()
const categoryName = computed(() => getToolCategoryName(tool.value?.id))
const calculator = useFinancialCalculators({ initialId: variant.value })
const formatValue = computed(() => createFinancialFormatter(preferences.settings))
const copiedHistoryId = ref('')

// A move between them does not remount this view, so both the calculator on show and the recent
// tool follow the route rather than the mount.
watch(variant, (id) => calculator.selectCalculator(id))
watch(() => tool.value?.id, (toolId) => toolId && preferences.recordRecent(toolId), { immediate: true })

function copyResult() {
  const presentation = calculator.presentedResult.value
  if (!presentation) return
  const lines = [
    calculator.activeCalculator.value.name,
    `${presentation.primary.label}: ${formatValue.value(
      presentation.primary.value,
      presentation.primary.format,
    )}`,
    ...presentation.rows.map((row) => `${row.label}: ${formatValue.value(row.value, row.format)}`),
    `Assumption: ${presentation.assumption}`,
    'Estimate only. Not financial advice or a guarantee of returns.',
  ]
  void calculator.copyResult(lines.join('\n'))
  calculator.recordHistory(formatValue.value)
}

async function copyHistoryEntry(entry) {
  try {
    await globalThis.navigator?.clipboard?.writeText(entry.value)
    copiedHistoryId.value = entry.id
  } catch {
    copiedHistoryId.value = ''
  }
}
</script>
