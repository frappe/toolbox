<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      icon="lucide-calculator"
      :category="categoryName"
      title="Calculator"
      description="Type a complete expression or use the standard and scientific keys."
    />

    <div class="pt-8">
      <section class="min-w-0" aria-label="Calculator workspace">
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-5">
          <!--
            TextInput rather than FormControl: the view drives the caret directly
            (select, setSelectionRange, selectionStart) and needs the component's
            exposed `el`, which FormControl does not forward.
          -->
          <TextInput
            id="calculator-expression"
            ref="expressionField"
            type="text"
            size="lg"
            variant="outline"
            label="Expression"
            class="[&_input]:h-14 [&_input]:rounded-xl [&_input]:px-4 [&_input]:font-mono [&_input]:text-xl"
            :model-value="expression"
            :error="errorMessage"
            placeholder="Example: sqrt(81) + sin(30)"
            inputmode="decimal"
            autocapitalize="off"
            spellcheck="false"
            aria-describedby="calculator-keyboard-hint"
            @update:model-value="calculator.updateExpression"
            @keydown="handleInputKeydown"
          />

          <div class="flex min-h-20 items-center gap-4 px-1 py-4">
            <div class="min-w-0 flex-1">
              <p class="text-sm text-ink-gray-5">Result</p>
              <output
                class="block truncate pt-1 font-mono text-4xl font-semibold tracking-tight text-ink-gray-9 sm:text-5xl"
                aria-label="Calculation result"
                aria-live="polite"
              >
                {{ result || '—' }}
              </output>
            </div>
          </div>

          <CalculatorKeypad @insert="insertKey" @action="handleKeypadAction" />

          <div class="flex items-center gap-2 pt-4">
            <span class="text-sm font-medium text-ink-gray-7">Angle</span>
            <TabButtons
              :model-value="angleMode"
              :options="angleTabs"
              size="md"
              aria-label="Angle mode"
              @update:model-value="calculator.setAngleMode"
            />
          </div>

          <!-- Not `ink-gray-4`, which is #999999 and 2.68:1 on this card, and not `ink-gray-5`
               either, which measures 3.93:1 and also misses 4.5:1. This line tells a visitor which
               keys work, so it has to be readable. It sat below the fold, which is why the sweep
               never saw it until the scan started covering the whole page. -->
          <p id="calculator-keyboard-hint" class="pt-4 text-sm leading-6 text-ink-gray-6">
            Enter calculates, Backspace deletes, and Escape clears while the expression field is focused.
          </p>
        </section>
      </section>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { TabButtons, TextInput } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import CalculatorKeypad from '@/tools/calculator/CalculatorKeypad.vue'
import { ANGLE_MODES } from '@/tools/calculator'
import { useCalculator } from '@/tools/calculator/useCalculator'
import { getToolCategoryName } from '@/data/toolRegistry'

const categoryName = getToolCategoryName('calculator')
const angleTabs = [
  { label: 'DEG', value: ANGLE_MODES.DEGREES },
  { label: 'RAD', value: ANGLE_MODES.RADIANS },
]
const expressionField = ref(null)
const preferences = useToolboxPreferences()
const calculator = useCalculator()
const { expression, result, errorMessage, angleMode } = calculator

onMounted(() => preferences.recordRecent('calculator'))

// TextInput exposes its underlying <input> as `el`.
function expressionElement() {
  return expressionField.value?.el ?? null
}

async function insertKey(key) {
  const input = expressionElement()
  const caret = calculator.insertText(
    key.value,
    input?.selectionStart,
    input?.selectionEnd,
    { startsNewExpression: key.startsNewExpression },
  )
  await focusExpression(caret)
}

async function handleKeypadAction(action) {
  if (action === 'calculate') {
    await runCalculation()
    return
  }

  const input = expressionElement()
  const actions = {
    'clear-all': () => calculator.clearExpression(),
    'clear-entry': () => calculator.clearCurrentInput(input?.selectionStart, input?.selectionEnd),
    'backspace': () => calculator.backspace(input?.selectionStart, input?.selectionEnd),
    'toggle-sign': () => calculator.toggleSign(input?.selectionStart, input?.selectionEnd),
  }
  const caret = actions[action]?.()
  await focusExpression(caret)
}

async function handleInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    await runCalculation()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    calculator.clearExpression()
    await focusExpression(0)
    return
  }

  if (event.key === 'Backspace') {
    event.preventDefault()
    const caret = calculator.backspace(event.target.selectionStart, event.target.selectionEnd)
    await focusExpression(caret)
  }
}

async function runCalculation() {
  const succeeded = calculator.calculate()
  await nextTick()
  if (succeeded) expressionElement()?.select()
  else expressionElement()?.focus()
}

async function focusExpression(caret = expression.value.length) {
  await nextTick()
  const input = expressionElement()
  input?.focus()
  input?.setSelectionRange(caret, caret)
}
</script>
