<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-calculator" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Calculate</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          Calculator
        </h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">
          Type a complete expression or use the standard and scientific keys.
        </p>
      </div>
      <Button
        variant="subtle"
        icon="lucide-star"
        :label="preferences.isFavourite('calculator') ? 'Favourited' : 'Favourite'"
        @click="preferences.toggleFavourite('calculator')"
      />
    </header>

    <div class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <section class="min-w-0" aria-label="Calculator workspace">
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6">
          <label for="calculator-expression" class="text-sm font-medium text-ink-gray-7">
            Expression
          </label>

          <input
            id="calculator-expression"
            ref="expressionInput"
            type="text"
            class="mt-3 h-14 w-full rounded-xl border bg-surface-base px-4 font-mono text-xl text-ink-gray-9 outline-none transition focus:border-outline-gray-4 focus:ring-2 focus:ring-outline-gray-2"
            :class="errorMessage ? 'border-outline-red-3' : 'border-outline-gray-2'"
            :value="expression"
            placeholder="Example: sqrt(81) + sin(30)"
            inputmode="decimal"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :aria-invalid="Boolean(errorMessage)"
            :aria-describedby="errorMessage ? 'calculator-error' : 'calculator-keyboard-hint'"
            @input="calculator.updateExpression($event.target.value)"
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

          <p
            v-if="errorMessage"
            id="calculator-error"
            class="mb-4 rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-3"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <CalculatorKeypad @insert="insertKey" @action="handleKeypadAction" />

          <div class="flex items-center gap-2 pt-5" role="group" aria-label="Angle mode">
            <span class="text-sm font-medium text-ink-gray-7">Angle</span>
            <Button
              class="h-10 min-w-12"
              label="DEG"
              :variant="angleMode === ANGLE_MODES.DEGREES ? 'solid' : 'outline'"
              :aria-pressed="angleMode === ANGLE_MODES.DEGREES"
              aria-label="Use degrees"
              data-angle-mode="degrees"
              @click="calculator.setAngleMode(ANGLE_MODES.DEGREES)"
            />
            <Button
              class="h-10 min-w-12"
              label="RAD"
              :variant="angleMode === ANGLE_MODES.RADIANS ? 'solid' : 'outline'"
              :aria-pressed="angleMode === ANGLE_MODES.RADIANS"
              aria-label="Use radians"
              data-angle-mode="radians"
              @click="calculator.setAngleMode(ANGLE_MODES.RADIANS)"
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
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolHistory from '@/components/history/ToolHistory.vue'
import CalculatorKeypad from '@/tools/calculator/CalculatorKeypad.vue'
import { ANGLE_MODES } from '@/tools/calculator'
import { useCalculator } from '@/tools/calculator/useCalculator'
import { useCalculatorHistory } from '@/tools/calculator/useCalculatorHistory'

const expressionInput = ref(null)
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

async function insertKey(key) {
  const input = expressionInput.value
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

  const input = expressionInput.value
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
  if (succeeded) expressionInput.value?.select()
  else expressionInput.value?.focus()
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
  expressionInput.value?.focus()
  expressionInput.value?.setSelectionRange(caret, caret)
}
</script>
