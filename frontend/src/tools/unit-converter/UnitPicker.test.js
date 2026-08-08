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

// The popover, keyboard navigation and focus handling now come from frappe-ui
// Combobox. What stays this component's own is the trigger it renders and the
// ranked, category-scoped option list it feeds in.
describe('UnitPicker', () => {
  it('names the trigger and its search field after the picker label', async () => {
    const wrapper = mountPicker()
    const trigger = wrapper.get('button[aria-haspopup="listbox"]')
    expect(trigger.text()).toContain('Meter')
    expect(trigger.text()).toContain('m')

    await trigger.trigger('click')
    expect(wrapper.get('[role="combobox"]').attributes('aria-label')).toBe('Search from unit')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
  })

  it('searches names and aliases and emits the selected unit', async () => {
    const wrapper = mountPicker()
    await wrapper.get('button[aria-haspopup="listbox"]').trigger('click')
    await wrapper.get('[role="combobox"]').setValue('feet')

    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0].text()).toContain('Foot')
    await options[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['foot']])
  })

  it('shows an empty search state without leaving its category', async () => {
    const wrapper = mountPicker({ categoryId: 'temperature', modelValue: 'celsius' })
    await wrapper.get('button[aria-haspopup="listbox"]').trigger('click')
    await wrapper.get('[role="combobox"]').setValue('mile')

    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    expect(wrapper.get('[role="status"]').text()).toBe('No matching units')
  })

  it('clears the query when the picker closes', async () => {
    const wrapper = mountPicker()
    const trigger = wrapper.get('button[aria-haspopup="listbox"]')
    await trigger.trigger('click')
    await wrapper.get('[role="combobox"]').setValue('feet')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(1)

    await trigger.trigger('click')
    await trigger.trigger('click')
    expect(wrapper.get('[role="combobox"]').element.value).toBe('')
    expect(wrapper.findAll('[role="option"]').length).toBeGreaterThan(1)
  })
})
