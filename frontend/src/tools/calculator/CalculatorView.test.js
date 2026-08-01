import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CalculatorView from '@/views/tools/CalculatorView.vue'

let writeText

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

describe('CalculatorView calculations', () => {
  it('calculates typed expressions and adds them to local history', async () => {
    const wrapper = mount(CalculatorView)
    await calculateExpression(wrapper, '2 + 3 * 4')

    expect(resultOutput(wrapper).text()).toBe('14')
    expect(wrapper.get('[aria-label="Calculator history entries"]').text()).toContain('2 + 3 * 4')
    expect(wrapper.get('[aria-label="Calculator history entries"]').text()).toContain('14')
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
    const radians = wrapper.get('[data-angle-mode="radians"]')

    await radians.trigger('click')
    expect(radians.attributes('aria-pressed')).toBe('true')

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

    await wrapper.get('[data-angle-mode="radians"]').trigger('keydown', { key: 'Escape' })
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

describe('CalculatorView history', () => {
  it('persists expressions and results across remounts', async () => {
    const firstWrapper = mount(CalculatorView)
    await calculateExpression(firstWrapper, 'square(12)')
    firstWrapper.unmount()

    const secondWrapper = mount(CalculatorView)
    const history = secondWrapper.get('[aria-label="Calculator history entries"]')

    expect(history.text()).toContain('square(12)')
    expect(history.text()).toContain('144')
  })

  it('reuses, copies, deletes, and clears history entries', async () => {
    const wrapper = mount(CalculatorView)
    await calculateExpression(wrapper, '2 + 3')
    await calculateExpression(wrapper, '4 * 5')

    await buttonByLabel(wrapper, 'Reuse 2 + 3').trigger('click')
    expect(expressionInput(wrapper).element.value).toBe('2 + 3')

    await wrapper.get('[aria-label="Copy result 5"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('5')
    expect(wrapper.get('[aria-label="Copied result 5"]').exists()).toBe(true)

    await buttonByLabel(wrapper, 'Delete 2 + 3 from history').trigger('click')
    expect(findButtonByLabel(wrapper, 'Reuse 2 + 3')).toBeUndefined()

    await wrapper.get('[aria-label="Clear calculator history"]').trigger('click')
    expect(wrapper.text()).toContain('No calculations yet')
    expect(globalThis.localStorage.getItem('toolbox:calculator-history:v1')).toBe('[]')
  })

  it('copies the current result only after an explicit action', async () => {
    const wrapper = mount(CalculatorView)
    await calculateExpression(wrapper, '9 / 4')

    expect(writeText).not.toHaveBeenCalled()
    await wrapper.get('[aria-label="Copy current result"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('2.25')
    expect(wrapper.get('[aria-label="Result copied"]').exists()).toBe(true)
  })

  it('clears copied state after calculating a different result', async () => {
    const wrapper = mount(CalculatorView)
    await calculateExpression(wrapper, '2 + 3')
    await wrapper.get('[aria-label="Copy current result"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="Result copied"]').exists()).toBe(true)

    await calculateExpression(wrapper, '4 + 5')

    expect(resultOutput(wrapper).text()).toBe('9')
    expect(wrapper.get('[aria-label="Copy current result"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Result copied"]').exists()).toBe(false)
  })

  it('does not show copied state when copying the current result fails', async () => {
    const wrapper = mount(CalculatorView)
    await calculateExpression(wrapper, '2 + 3')
    await wrapper.get('[aria-label="Copy current result"]').trigger('click')
    await flushPromises()

    await calculateExpression(wrapper, '4 + 5')
    writeText.mockRejectedValueOnce(new Error('Clipboard denied'))
    await wrapper.get('[aria-label="Copy current result"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[aria-label="Copy current result"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Result copied"]').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toBe('Copy is unavailable in this browser.')
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

function buttonByLabel(wrapper, label) {
  const button = findButtonByLabel(wrapper, label)
  if (!button) throw new Error(`Could not find button labelled "${label}".`)
  return button
}

function findButtonByLabel(wrapper, label) {
  return wrapper.findAll('button').find((button) => button.attributes('aria-label') === label)
}
