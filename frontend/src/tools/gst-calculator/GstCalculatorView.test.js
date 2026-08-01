import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import GstCalculatorView from '@/views/tools/GstCalculatorView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

function mountView(query = '') {
  globalThis.history.replaceState({}, '', `/toolbox/gst-calculator${query}`)
  return mount(GstCalculatorView, { attachTo: document.body })
}

function buttonByText(wrapper, label) {
  return wrapper.findAll('button').find((button) => button.text() === label)
}

describe('GstCalculatorView', () => {
  beforeEach(() => {
    globalThis.history.replaceState({}, '', '/toolbox/gst-calculator')
  })

  it('tracks recent use and exposes the Favourite action', async () => {
    const wrapper = mountView()
    expect(preferences.recordRecent).toHaveBeenCalledWith('gst-calculator')

    await buttonByText(wrapper, 'Favourite').trigger('click')
    expect(preferences.toggleFavourite).toHaveBeenCalledWith('gst-calculator')
  })

  it('calculates add-mode intra-state results immediately', async () => {
    const wrapper = mountView()
    await wrapper.get('#gst-amount').setValue('1000')

    expect(wrapper.get('output[aria-label="GST final amount"]').text()).toContain('1,180.00')
    expect(wrapper.text()).toContain('₹90.00')
    expect(wrapper.text()).toContain('₹180.00')
    expect(wrapper.get('[data-testid="gst-result-status"]').text()).toContain(
      'Total GST: INR 180.00',
    )
  })

  it('switches to remove-mode inter-state results', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-mode="remove"]').trigger('click')
    await wrapper.get('[data-supply-type="inter-state"]').trigger('click')
    await wrapper.get('#gst-amount').setValue('1180')

    expect(wrapper.get('label[for="gst-amount"]').text()).toBe('GST-inclusive amount')
    expect(wrapper.text()).toContain('Inclusive amount')
    expect(wrapper.text()).toContain('₹180.00')
  })

  it('uses standard and custom rate controls', async () => {
    const wrapper = mountView()
    await wrapper.get('#gst-amount').setValue('2000')
    await wrapper.get('[data-rate-id="five"]').trigger('click')
    expect(wrapper.text()).toContain('₹100.00')

    await wrapper.get('[data-rate-id="custom"]').trigger('click')
    expect(wrapper.get('#custom-gst-rate').attributes('aria-describedby')).toBe('gst-feedback')
    await wrapper.get('#custom-gst-rate').setValue('7.5')
    expect(wrapper.text()).toContain('₹150.00')
  })

  it('accepts only a safely parsed rate query handoff', () => {
    const validWrapper = mountView('?rate=7.5%25')
    expect(validWrapper.text()).toContain('Rate supplied by HSN lookup.')
    expect(validWrapper.get('#custom-gst-rate').element.value).toBe('7.5')
    validWrapper.unmount()

    const invalidWrapper = mountView('?rate=18%25%20extra')
    expect(invalidWrapper.text()).not.toContain('Rate supplied by HSN lookup.')
    expect(invalidWrapper.get('[data-rate-id="eighteen"]').attributes('aria-pressed')).toBe('true')
  })

  it('clears stale results and exposes validation errors', async () => {
    const wrapper = mountView()
    const amountInput = wrapper.get('#gst-amount')
    await amountInput.setValue('1000')
    expect(wrapper.find('output').exists()).toBe(true)

    await amountInput.setValue('-')
    expect(wrapper.find('output').exists()).toBe(false)
    expect(wrapper.text()).toContain('Finish entering')
    expect(wrapper.get('[data-testid="gst-result-status"]').text()).toBe('')

    await amountInput.setValue('invalid')
    expect(wrapper.get('[role="alert"]').text()).toBe('Enter a valid amount.')
    expect(amountInput.attributes('aria-invalid')).toBe('true')
  })

  it('copies a structured summary and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mountView()
    await wrapper.get('#gst-amount').setValue('1000')
    await buttonByText(wrapper, 'Copy summary').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('CGST: INR 90.00')
    expect(wrapper.get('[data-testid="gst-copy-status"]').text()).toBe('GST summary copied.')
  })

  it('clears values, resets choices, and keeps controls touch-sized', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-mode="remove"]').trigger('click')
    await wrapper.get('[data-rate-id="five"]').trigger('click')
    await wrapper.get('#gst-amount').setValue('105')
    await buttonByText(wrapper, 'Clear').trigger('click')
    expect(wrapper.get('#gst-amount').element.value).toBe('')
    expect(wrapper.get('[data-mode="remove"]').attributes('aria-pressed')).toBe('true')

    await buttonByText(wrapper, 'Reset').trigger('click')
    expect(wrapper.get('[data-mode="add"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-rate-id="eighteen"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('button.h-11').length).toBeGreaterThan(10)
  })
})
