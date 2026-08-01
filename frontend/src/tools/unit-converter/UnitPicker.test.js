import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UnitPicker from './UnitPicker.vue'

function mountPicker(props = {}) {
  return mount(UnitPicker, {
    attachTo: document.body,
    props: {
      modelValue: 'meter',
      categoryId: 'length',
      label: 'From unit',
      ...props,
    },
  })
}

describe('UnitPicker', () => {
  it('opens with focus in an accessible search field', async () => {
    const wrapper = mountPicker()
    await wrapper.get('button[aria-haspopup="listbox"]').trigger('click')

    const search = wrapper.get('input[type="search"]')
    expect(search.attributes('aria-label')).toBe('Search from unit')
    expect(document.activeElement).toBe(search.element)
    expect(wrapper.get('[role="listbox"]').attributes('aria-label')).toBe('From unit')
  })

  it('searches names and aliases and emits the selected unit', async () => {
    const wrapper = mountPicker()
    await wrapper.get('button[aria-haspopup="listbox"]').trigger('click')
    await wrapper.get('input[type="search"]').setValue('feet')

    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0].text()).toContain('Foot')
    await options[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['foot']])
  })

  it('shows an empty search state without leaving its category', async () => {
    const wrapper = mountPicker({ categoryId: 'temperature', modelValue: 'celsius' })
    await wrapper.get('button[aria-haspopup="listbox"]').trigger('click')
    await wrapper.get('input[type="search"]').setValue('mile')

    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    expect(wrapper.get('[role="status"]').text()).toBe('No matching units')
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const wrapper = mountPicker()
    const trigger = wrapper.get('button[aria-haspopup="listbox"]')
    await trigger.trigger('click')
    await wrapper.get('input[type="search"]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })
})
