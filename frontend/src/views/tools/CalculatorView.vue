<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-calculator" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">{{ categoryName }}</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          Calculator
        </h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">
          Type a complete expression or use the standard and scientific keys.
        </p>
      </div>
    </header>

    <div class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <section class="min-w-0" aria-label="Calculator workspace">
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6">
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
            <Button
              class="size-11 shrink-0"
              variant="ghost"
            :icon="copiedCurrentResultValue === result ? 'lucide-check' : 'lucide-copy'"
            :disabled="!result"
            :aria-label="copiedCurrentResultValue === result ? 'Result copied' : 'Copy current result'"
              @click="copyCurrentResult"
            />
          </div>

          <CalculatorKeypad @insert="insertKey" @action="handleKeypadAction" />

          <div class="flex items-center gap-2 pt-5">
            <span class="text-sm font-medium text-ink-gray-7">Angle</span>
            <TabButtons
              :model-value="angleMode"
              :options="angleTabs"
              size="md"
              aria-label="Angle mode"
              @update:model-value="calculator.setAngleMode"
            />
          </div>

          <p id="calculator-keyboard-hint" class="pt-4 text-sm leading-6 text-ink-gray-4">
            Enter calculates, Backspace deletes, and Escape clears while the expression field is focused.
          </p>
        </section>
      </section>

      <aside class="min-w-0 lg:sticky lg:top-6">
        <ToolHistory
          :entries="historyEntries"
          :copied-entry-id="copiedEntryId"
          list-label="Calculator history entries"
          clear-label="Clear calculator history"
          empty-title="No calculations yet"
          empty-description="Completed expressions will appear here for reuse."
          reuse-title="Reuse this expression"
          mono
          @reuse="reuseHistoryEntry"
          @copy="copyHistoryEntry"
          @remove="history.remove"
          @clear="clearHistory"
        />
      </aside>
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ copyStatus }}</p>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Button, Icon, TabButtons, TextInput } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolHistory from '@/components/history/ToolHistory.vue'
import CalculatorKeypad from '@/tools/calculator/CalculatorKeypad.vue'
import { ANGLE_MODES } from '@/tools/calculator'
import { useCalculator } from '@/tools/calculator/useCalculator'
import { useCalculatorHistory } from '@/tools/calculator/useCalculatorHistory'
import { getToolCategoryName } from '@/data/toolRegistry'

const categoryName = getToolCategoryName('calculator')
const angleTabs = [
  { label: 'DEG', value: ANGLE_MODES.DEGREES },
  { label: 'RAD', value: ANGLE_MODES.RADIANS },
]
const expressionField = ref(null)
const copiedEntryId = ref('')
const copiedCurrentResultValue = ref(null)
const copyStatus = ref('')
const preferences = useToolboxPreferences()
const history = useCalculatorHistory()
// The Calculator keeps its own storage shape ({ expression, result }); map it onto the
// shared history contract ({ label, value }) so the panel matches every other tool.
const historyEntries = computed(() =>
  history.entries.value.map((entry) => ({
    id: entry.id,
    label: entry.expression,
    value: entry.result,
    timestamp: entry.timestamp,
  })),
)
const calculator = useCalculator({ onCalculated: history.add })
const { expression, result, errorMessage, angleMode } = calculator

onMounted(() => preferences.recordRecent('calculator'))
watch([expression, result, angleMode], () => {
  copiedCurrentResultValue.value = null
})

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

async function reuseHistoryEntry(entry) {
  calculator.reuseExpression(entry.label)
  await focusExpression(entry.label.length)
}

async function copyHistoryEntry(entry) {
  if (await copyText(entry.value)) {
    copiedEntryId.value = entry.id
    copiedCurrentResultValue.value = null
  }
}

async function copyCurrentResult() {
  if (!result.value) return
  const value = result.value
  if (await copyText(value)) {
    copiedCurrentResultValue.value = value
    copiedEntryId.value = ''
  } else {
    copiedCurrentResultValue.value = null
  }
}

async function copyText(value) {
  try {
    if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await globalThis.navigator.clipboard.writeText(value)
    copyStatus.value = `Copied ${value}.`
    return true
  } catch {
    copyStatus.value = 'Copy is unavailable in this browser.'
    return false
  }
}

function clearHistory() {
  history.clear()
  copiedEntryId.value = ''
}

async function focusExpression(caret = expression.value.length) {
  await nextTick()
  const input = expressionElement()
  input?.focus()
  input?.setSelectionRange(caret, caret)
}
</script>
