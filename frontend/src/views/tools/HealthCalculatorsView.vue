<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2"><Icon :name="tool.icon" class="size-6 text-ink-gray-7" /></span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Calculate</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">{{ tool.name }}</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">{{ tool.description }} Nothing you type is saved or sent anywhere.</p>
      </div>
    </header>

    <div class="-mx-1 overflow-x-auto px-1 pt-8">
      <ToolFamilyNav label="Health calculator" :links="siblingLinks" :current-route="currentRoute" />
    </div>

    <div class="grid gap-8 pt-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <section class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6" :aria-labelledby="`${calculator.activeId.value}-health-heading`">
        <h2 :id="`${calculator.activeId.value}-health-heading`" class="text-lg font-semibold text-ink-gray-9">{{ calculator.activeCalculator.value.name }}</h2>
        <p class="pt-1 text-sm leading-6 text-ink-gray-6">{{ calculator.activeCalculator.value.description }}</p>
        <div class="grid gap-5 pt-6 sm:grid-cols-2">
          <HealthInput v-for="input in calculator.activeInputs.value" :key="input.id" :input="input" :input-id="`${calculator.activeId.value}-${input.id}`" :model-value="calculator.activeValues.value[input.id]" :described-by="`${calculator.activeId.value}-health-feedback`" @update:model-value="calculator.updateInput(input.id, $event)" />
        </div>
        <div :id="`${calculator.activeId.value}-health-feedback`" class="pt-4">
          <ErrorMessage v-if="calculator.errorMessage.value" :message="calculator.errorMessage.value" />
          <p v-else class="text-sm leading-6 text-ink-gray-5">Inputs stay in this browser tab and are not saved.</p>
        </div>
        <div class="flex gap-2 pt-5"><Button label="Calculate" variant="solid" class="h-11" @click="calculator.calculate" /><Button label="Reset" variant="ghost" class="h-11" @click="calculator.reset" /></div>
      </section>
      <HealthResults class="lg:sticky lg:top-6" :presentation="calculator.presentation.value" />
    </div>
  </div>
</template>
<script setup>
import { watch } from 'vue'
import { Button, ErrorMessage, Icon } from 'frappe-ui'
import ToolFamilyNav from '@/components/ToolFamilyNav.vue'
import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import HealthInput from '@/tools/health-calculators/HealthInput.vue'
import HealthResults from '@/tools/health-calculators/HealthResults.vue'
import { useHealthCalculators } from '@/tools/health-calculators/useHealthCalculators'
const preferences = useToolboxPreferences()
// Four calculators with four routes, rendered here together because they share the body
// measurements a visitor types: moving from BMI to BMR keeps the height and weight already given.
const { tool, variant, siblingLinks, currentRoute } = useToolFamily()
const calculator = useHealthCalculators(variant.value)

// A move between them does not remount this view, so both the calculator on show and the recent
// tool follow the route rather than the mount.
watch(variant, (id) => calculator.selectCalculator(id))
watch(() => tool.value?.id, (toolId) => toolId && preferences.recordRecent(toolId), { immediate: true })
</script>
