import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CalculatorView from '@/views/tools/CalculatorView.vue'

describe('CalculatorView calculations', () => {
  it('calculates typed expressions', async () => {
    const wrapper = mount(CalculatorView)
    await calculateExpression(wrapper, '2 + 3 * 4')

    expect(resultOutput(wrapper).text()).toBe('14')
  })

  it('supports the standard and scientific keypad', async () => {
    const wrapper = mount(CalculatorView)

    await pressKey(wrapper, 'sqrt')
    await pressKey(wrapper, '9')
    await pressKey(wrapper, 'right-parenthesis')
    await pressKey(wrapper, 'add')
    await pressKey(wrapper, '3')
    await pressKey(wrapper, 'calculate')

    expect(expressionInput(wrapper).element.value).toBe('sqrt(9)+3')
    expect(resultOutput(wrapper).text()).toBe('6')
  })

  it('switches between degree and radian calculations', async () => {
    const wrapper = mount(CalculatorView)
    const radians = angleTab(wrapper, 'RAD')

    await radians.trigger('click')
    expect(angleTab(wrapper, 'RAD').attributes('aria-checked')).toBe('true')

    await calculateExpression(wrapper, 'sin(pi / 2)')
    expect(resultOutput(wrapper).text()).toBe('1')
  })

  it('shows safe parser errors and recovers as soon as input changes', async () => {
    const wrapper = mount(CalculatorView)
    await calculateExpression(wrapper, '2 +')

    expect(wrapper.get('[role="alert"]').text()).toBe('Expected a value at the end of the expression.')
    expect(expressionInput(wrapper).attributes('aria-invalid')).toBe('true')

    await expressionInput(wrapper).setValue('2 + 3')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    await expressionInput(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(resultOutput(wrapper).text()).toBe('5')
  })
})

describe('CalculatorView editing and keyboard behavior', () => {
  it('handles Backspace, Escape, and Enter only from the expression editor', async () => {
    const wrapper = mount(CalculatorView)
    const input = expressionInput(wrapper)
    await input.setValue('123')
    input.element.setSelectionRange(3, 3)

    await input.trigger('keydown', { key: 'Backspace' })
    expect(input.element.value).toBe('12')

    await angleTab(wrapper, 'RAD').trigger('keydown', { key: 'Escape' })
    expect(input.element.value).toBe('12')

    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(resultOutput(wrapper).text()).toBe('12')

    await input.trigger('keydown', { key: 'Escape' })
    expect(input.element.value).toBe('')
    expect(resultOutput(wrapper).text()).toBe('—')
  })

  it('clears the current input, full expression, and selected ranges', async () => {
    const wrapper = mount(CalculatorView)
    const input = expressionInput(wrapper)
    await input.setValue('12+345')
    input.element.setSelectionRange(6, 6)

    await pressKey(wrapper, 'clear-entry')
    expect(input.element.value).toBe('12+')

    await input.setValue('98+76')
    input.element.setSelectionRange(0, 2)
    await pressKey(wrapper, 'clear-entry')
    expect(input.element.value).toBe('+76')

    await input.setValue('98')
    input.element.setSelectionRange(2, 2)
    await pressKey(wrapper, 'backspace')
    expect(input.element.value).toBe('9')

    await pressKey(wrapper, 'clear-all')
    expect(input.element.value).toBe('')
  })

  it('continues from a result with operators and starts fresh with numbers', async () => {
    const wrapper = mount(CalculatorView)
    await calculateExpression(wrapper, '2 + 3')

    await pressKey(wrapper, 'multiply')
    await pressKey(wrapper, '4')
    expect(expressionInput(wrapper).element.value).toBe('5×4')

    await pressKey(wrapper, 'calculate')
    expect(resultOutput(wrapper).text()).toBe('20')

    await pressKey(wrapper, '7')
    expect(expressionInput(wrapper).element.value).toBe('7')
  })
})

async function calculateExpression(wrapper, expression) {
  await expressionInput(wrapper).setValue(expression)
  await expressionInput(wrapper).trigger('keydown', { key: 'Enter' })
  await flushPromises()
}

async function pressKey(wrapper, key) {
  await wrapper.get(`[data-calculator-key="${key}"]`).trigger('click')
  await flushPromises()
}

function expressionInput(wrapper) {
  return wrapper.get('#calculator-expression')
}

function resultOutput(wrapper) {
  return wrapper.get('[aria-label="Calculation result"]')
}

function angleTab(wrapper, label) {
  return wrapper.findAll('[role="radio"]').find((tab) => tab.text() === label)
}
