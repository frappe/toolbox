import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SegmentedTabs from './SegmentedTabs.vue'

const tabs = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
]

function mountTabs(modelValue = 'one') {
  return mount(SegmentedTabs, {
    props: { tabs, modelValue, ariaLabel: 'Example tabs' },
    attachTo: document.body,
  })
}

describe('SegmentedTabs', () => {
  it('marks the active tab and gives it the only roving tab stop', () => {
    const wrapper = mountTabs('two')
    const buttons = wrapper.findAll('[role="tab"]')

    expect(buttons.map((button) => button.attributes('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(buttons.map((button) => button.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(buttons[1].attributes('data-tab-id')).toBe('two')
  })

  it('emits the chosen tab on click', async () => {
    const wrapper = mountTabs('one')
    await wrapper.get('[data-tab-id="three"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['three'])
  })

  it('moves selection with arrow, Home, and End keys', async () => {
    const wrapper = mountTabs('one')
    const buttons = wrapper.findAll('[role="tab"]')

    await buttons[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['two'])

    await buttons[0].trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['three'])

    await buttons[0].trigger('keydown', { key: 'ArrowLeft' })
    // Wraps from the first tab back to the last.
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['three'])
  })
})
