<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2"><Icon name="lucide-activity" class="size-6 text-ink-gray-7" /></span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Calculate</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Health &amp; Fitness Calculators</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Explore formula-based estimates without saving or sending your health inputs.</p>
      </div>
    </header>

    <nav class="-mx-1 overflow-x-auto px-1 pt-8" aria-label="Health calculator">
      <div class="flex min-w-max gap-2"><Button v-for="item in calculator.calculators" :key="item.id" class="h-11" :label="item.shortName" :variant="calculator.activeId.value === item.id ? 'subtle' : 'ghost'" :aria-pressed="calculator.activeId.value === item.id" @click="calculator.selectCalculator(item.id)" /></div>
    </nav>

    <div class="grid gap-8 pt-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <section class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6" :aria-labelledby="`${calculator.activeId.value}-health-heading`">
        <h2 :id="`${calculator.activeId.value}-health-heading`" class="text-lg font-semibold text-ink-gray-9">{{ calculator.activeCalculator.value.name }}</h2>
        <p class="pt-1 text-sm leading-6 text-ink-gray-6">{{ calculator.activeCalculator.value.description }}</p>
        <div class="grid gap-5 pt-6 sm:grid-cols-2">
          <HealthInput v-for="input in calculator.activeInputs.value" :key="input.id" :input="input" :input-id="`${calculator.activeId.value}-${input.id}`" :model-value="calculator.activeValues.value[input.id]" :described-by="`${calculator.activeId.value}-health-feedback`" @update:model-value="calculator.updateInput(input.id, $event)" />
        </div>
        <div :id="`${calculator.activeId.value}-health-feedback`" class="pt-4">
          <p v-if="calculator.errorMessage.value" class="rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-3" role="alert">{{ calculator.errorMessage.value }}</p>
          <p v-else class="text-sm leading-6 text-ink-gray-5">Inputs stay in this browser tab and are not saved.</p>
        </div>
        <div class="flex gap-2 pt-5"><Button label="Calculate" variant="solid" class="h-11" @click="calculator.calculate" /><Button label="Reset" variant="ghost" class="h-11" @click="calculator.reset" /></div>
      </section>
      <HealthResults class="lg:sticky lg:top-6" :presentation="calculator.presentation.value" />
    </div>
  </div>
</template>
<script setup>
import { onMounted } from 'vue'
import { Button, Icon } from 'frappe-ui'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import HealthInput from '@/tools/health-calculators/HealthInput.vue'
import HealthResults from '@/tools/health-calculators/HealthResults.vue'
import { useHealthCalculators } from '@/tools/health-calculators/useHealthCalculators'
const preferences = useToolboxPreferences()
const calculator = useHealthCalculators()
onMounted(() => preferences.recordRecent('health-calculators'))
</script>
