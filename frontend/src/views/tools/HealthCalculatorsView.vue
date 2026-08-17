<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      :icon="tool.icon"
      :category="categoryName"
      :title="tool.name"
      :description="`${tool.description} Nothing you type is saved or sent anywhere.`"
    />

    <div class="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <section class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-5" :aria-labelledby="`${calculator.activeId.value}-health-heading`">
        <h2 :id="`${calculator.activeId.value}-health-heading`" class="text-lg font-semibold text-ink-gray-9">{{ calculator.activeCalculator.value.name }}</h2>
        <p class="pt-1 text-sm leading-6 text-ink-gray-6">{{ calculator.activeCalculator.value.description }}</p>
        <div class="grid gap-4 pt-5 sm:grid-cols-2">
          <HealthInput v-for="input in calculator.activeInputs.value" :key="input.id" :input="input" :input-id="`${calculator.activeId.value}-${input.id}`" :model-value="calculator.activeValues.value[input.id]" :described-by="`${calculator.activeId.value}-health-feedback`" @update:model-value="calculator.updateInput(input.id, $event)" />
        </div>
        <div :id="`${calculator.activeId.value}-health-feedback`" class="pt-3">
          <ErrorMessage v-if="calculator.errorMessage.value" :message="calculator.errorMessage.value" />
          <p v-else class="text-sm leading-6 text-ink-gray-5">Inputs stay in this browser tab and are not saved.</p>
        </div>
        <div class="flex gap-2 pt-4"><Button size="md" label="Calculate" variant="solid" @click="calculator.calculate" /><Button size="md" label="Reset" variant="ghost" @click="calculator.reset" /></div>
      </section>
      <HealthResults class="lg:sticky lg:top-6" :presentation="calculator.presentation.value" />
    </div>
  </div>
</template>
<script setup>
import { computed, watch } from 'vue'
import { Button, ErrorMessage } from 'frappe-ui'
import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import HealthInput from '@/tools/health-calculators/HealthInput.vue'
import HealthResults from '@/tools/health-calculators/HealthResults.vue'
import { useHealthCalculators } from '@/tools/health-calculators/useHealthCalculators'
import { getToolCategoryName } from '@/data/toolRegistry'
const preferences = useToolboxPreferences()
// Four calculators with four routes, rendered here together because they share the body
// measurements a visitor types: moving from BMI to BMR keeps the height and weight already given.
const { tool, variant } = useToolFamily()
const categoryName = computed(() => getToolCategoryName(tool.value?.id))
const calculator = useHealthCalculators(variant.value)

// A move between them does not remount this view, so both the calculator on show and the recent
// tool follow the route rather than the mount.
watch(variant, (id) => calculator.selectCalculator(id))
watch(() => tool.value?.id, (toolId) => toolId && preferences.recordRecent(toolId), { immediate: true })
</script>
