<template>
  <div class="flex flex-col gap-5">
    <section aria-labelledby="scientific-keypad-title">
      <h2 id="scientific-keypad-title" class="pb-2 text-sm font-medium text-ink-gray-7">
        Scientific
      </h2>
      <div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
        <!--
          The visible glyph and the spoken name differ, so the glyph goes in the default slot.
          A `label` prop would win over `aria-label` and every key would announce its glyph (#144).
        -->
        <Button
          v-for="key in scientificKeys"
          :key="key.id"
          class="w-full font-medium"
          size="lg"
          variant="subtle"
          :aria-label="key.ariaLabel"
          :data-calculator-key="key.id"
          @click="emit('insert', key)"
        >
          {{ key.label }}
        </Button>
      </div>
    </section>

    <section aria-labelledby="standard-keypad-title">
      <h2 id="standard-keypad-title" class="pb-2 text-sm font-medium text-ink-gray-7">
        Standard
      </h2>
      <div class="grid grid-cols-4 gap-2">
        <Button
          v-for="key in standardKeys"
          :key="key.id"
          class="w-full text-base font-medium"
          size="lg"
          :variant="key.variant"
          :theme="key.theme || 'gray'"
          :aria-label="key.ariaLabel"
          :data-calculator-key="key.id"
          @click="activate(key)"
        >
          {{ key.label }}
        </Button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { Button } from 'frappe-ui'

const emit = defineEmits(['insert', 'action'])

const scientificKeys = [
  functionKey('sin', 'sin(', 'Sine'),
  functionKey('cos', 'cos(', 'Cosine'),
  functionKey('tan', 'tan(', 'Tangent'),
  functionKey('asin', 'asin(', 'Inverse sine'),
  functionKey('acos', 'acos(', 'Inverse cosine'),
  functionKey('atan', 'atan(', 'Inverse tangent'),
  functionKey('log', 'log(', 'Base 10 logarithm'),
  functionKey('ln', 'ln(', 'Natural logarithm'),
  functionKey('sqrt', 'sqrt(', 'Square root', '√x'),
  insertKey('square', 'x²', '^2', 'Square the current result or expression'),
  insertKey('pi', 'π', 'pi', 'Pi', true),
  insertKey('e', 'e', 'e', 'Euler number', true),
]

const standardKeys = [
  actionKey('clear-all', 'AC', 'Clear full expression', 'subtle', 'red'),
  actionKey('clear-entry', 'CE', 'Clear current input', 'subtle', 'red'),
  insertKey('left-parenthesis', '(', '(', 'Left parenthesis', true),
  insertKey('right-parenthesis', ')', ')', 'Right parenthesis'),
  insertKey('7', '7', '7', 'Seven', true),
  insertKey('8', '8', '8', 'Eight', true),
  insertKey('9', '9', '9', 'Nine', true),
  insertKey('divide', '÷', '÷', 'Divide'),
  insertKey('4', '4', '4', 'Four', true),
  insertKey('5', '5', '5', 'Five', true),
  insertKey('6', '6', '6', 'Six', true),
  insertKey('multiply', '×', '×', 'Multiply'),
  insertKey('1', '1', '1', 'One', true),
  insertKey('2', '2', '2', 'Two', true),
  insertKey('3', '3', '3', 'Three', true),
  insertKey('subtract', '−', '−', 'Subtract'),
  actionKey('toggle-sign', '±', 'Change sign'),
  insertKey('0', '0', '0', 'Zero', true),
  insertKey('decimal', '.', '.', 'Decimal point', true),
  insertKey('add', '+', '+', 'Add'),
  insertKey('percent', '%', '%', 'Percent'),
  insertKey('power', '^', '^', 'Raise to a power'),
  actionKey('backspace', '⌫', 'Backspace'),
  actionKey('calculate', '=', 'Calculate', 'solid'),
]

function activate(key) {
  if (key.action) emit('action', key.action)
  else emit('insert', key)
}

function functionKey(id, value, ariaLabel, label = id) {
  return insertKey(id, label, value, ariaLabel, true)
}

function insertKey(id, label, value, ariaLabel, startsNewExpression = false) {
  return { id, label, value, ariaLabel, startsNewExpression, variant: 'subtle' }
}

function actionKey(action, label, ariaLabel, variant = 'subtle', theme = 'gray') {
  return { id: action, action, label, ariaLabel, variant, theme }
}
</script>
