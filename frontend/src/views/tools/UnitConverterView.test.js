import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import UnitConverterView from './UnitConverterView.vue'

function mountView() {
  return mount(UnitConverterView, { attachTo: document.body })
}

function valueInputs(wrapper) {
  return wrapper.findAll('input[inputmode="decimal"]')
}

describe('UnitConverterView', () => {
  it('converts edits in both fields immediately', async () => {
    const wrapper = mountView()
    const [fromInput, toInput] = valueInputs(wrapper)

    await fromInput.setValue('1000')
    expect(toInput.element.value).toBe('1')

    await toInput.setValue('2.5')
    expect(fromInput.element.value).toBe('2500')
  })

  it('changes category defaults and applies temperature formulas', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-category-id="temperature"]').trigger('click')
    const [fromInput, toInput] = valueInputs(wrapper)
    await fromInput.setValue('0')

    expect(wrapper.text()).toContain('Celsius')
    expect(wrapper.text()).toContain('Fahrenheit')
    expect(toInput.element.value).toBe('32')
  })

  it('searches for and selects a source unit', async () => {
    const wrapper = mountView()
    const pickerTriggers = wrapper.findAll('button[aria-haspopup="listbox"]')
    await pickerTriggers[0].trigger('click')
    await wrapper.get('input[type="search"]').setValue('feet')
    await wrapper.get('[role="option"]').trigger('click')

    expect(wrapper.findAll('button[aria-haspopup="listbox"]')[0].text()).toContain('Foot')
  })

  it('swaps displayed units and values', async () => {
    const wrapper = mountView()
    const [fromInput, toInput] = valueInputs(wrapper)
    await fromInput.setValue('1000')
    await wrapper.get('[data-testid="swap-units"]').trigger('click')

    expect(fromInput.element.value).toBe('1')
    expect(toInput.element.value).toBe('1000')
    const pickerTriggers = wrapper.findAll('button[aria-haspopup="listbox"]')
    expect(pickerTriggers[0].text()).toContain('Kilometer')
    expect(pickerTriggers[1].text()).toContain('Meter')
  })

  it('keeps the previous result through partial and invalid edits', async () => {
    const wrapper = mountView()
    const [fromInput, toInput] = valueInputs(wrapper)
    await fromInput.setValue('1000')

    await fromInput.setValue('-')
    expect(toInput.element.value).toBe('1')
    expect(wrapper.text()).toContain('Finish entering')

    await fromInput.setValue('invalid')
    expect(toInput.element.value).toBe('1')
    expect(wrapper.get('[role="alert"]').text()).toContain('valid, finite')
  })

  it('politely announces only valid programmatic result updates', async () => {
    const wrapper = mountView()
    const [fromInput] = valueInputs(wrapper)
    const announcement = wrapper.get('[data-testid="conversion-announcement"]')

    expect(announcement.attributes('role')).toBe('status')
    expect(announcement.attributes('aria-live')).toBe('polite')
    expect(announcement.attributes('aria-atomic')).toBe('true')
    expect(announcement.text()).toBe('')

    await fromInput.setValue('1000')
    expect(announcement.text()).toBe('Converted value: 1. Unit: kilometer.')

    await fromInput.setValue('-')
    expect(announcement.text()).toBe('')

    await fromInput.setValue('invalid')
    expect(announcement.text()).toBe('')

    await fromInput.setValue('')
    expect(announcement.text()).toBe('')
  })

  it('copies a valid result and announces success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mountView()
    await valueInputs(wrapper)[0].setValue('1000')
    const copyButton = wrapper.findAll('button').find((button) => button.text() === 'Copy result')
    await copyButton.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('1')
    expect(wrapper.get('[data-testid="copy-status"]').text()).toBe('Copied 1 km.')
  })

  it('records settled conversions in a history panel that persists locally', async () => {
    const firstWrapper = mountView()
    await valueInputs(firstWrapper)[0].setValue('1000')
    await valueInputs(firstWrapper)[0].trigger('change')
    await flushPromises()
    expect(firstWrapper.text()).toContain('1000 m → km')
    expect(firstWrapper.text()).toContain('1 km')
    firstWrapper.unmount()

    const secondWrapper = mountView()
    expect(secondWrapper.get('button[aria-label="Reuse 1000 m → km"]')).toBeTruthy()
  })

  it('clears the values while keeping the chosen category', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-category-id="temperature"]').trigger('click')
    await valueInputs(wrapper)[0].setValue('10')
    const clearButton = wrapper.findAll('button').find((button) => button.text() === 'Clear')
    await clearButton.trigger('click')
    expect(valueInputs(wrapper).map((input) => input.element.value)).toEqual(['', ''])
    // A single Clear empties the values but keeps the user's category.
    expect(wrapper.get('[data-category-id="temperature"]').attributes('aria-pressed')).toBe('true')
  })
})
