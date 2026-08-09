import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SearchSelect from './SearchSelect.vue'

const results = ['serendipity', 'serendipitous', 'serene']

function mountSelect(props = {}) {
  return mount(SearchSelect, {
    props: { label: 'Search a word', resultsLabel: 'Word suggestions', results, modelValue: 'ser', ...props },
    slots: { option: '<template #option="{ result }">{{ result }}</template>' },
    attachTo: document.body,
  })
}

function keydown(wrapper, key) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  wrapper.find('input').element.dispatchEvent(event)
  return event
}

describe('SearchSelect', () => {
  it('wires the combobox to a real listbox', () => {
    const wrapper = mountSelect()
    const input = wrapper.find('input')
    const listbox = wrapper.find('[role="listbox"]')

    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(input.attributes('aria-controls')).toBe(listbox.attributes('id'))
    expect(listbox.attributes('aria-label')).toBe('Word suggestions')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(3)
  })

  it('associates the label with the input', () => {
    const wrapper = mountSelect()

    expect(wrapper.find('label').attributes('for')).toBe(wrapper.find('input').attributes('id'))
  })

  it('closes when there are no results', () => {
    const wrapper = mountSelect({ results: [] })

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.find('input').attributes('aria-expanded')).toBe('false')
  })

  it('moves the active option with the arrow keys and wraps', async () => {
    const wrapper = mountSelect()
    const activeIds = []

    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']) {
      keydown(wrapper, key)
      await wrapper.vm.$nextTick()
      activeIds.push(wrapper.find('input').attributes('aria-activedescendant'))
    }

    const options = wrapper.findAll('[role="option"]').map((option) => option.attributes('id'))
    expect(activeIds).toEqual([options[0], options[1], options[2], options[0]])
  })

  it('wraps backwards from the top', async () => {
    const wrapper = mountSelect()
    keydown(wrapper, 'ArrowUp')
    await wrapper.vm.$nextTick()

    const options = wrapper.findAll('[role="option"]').map((option) => option.attributes('id'))
    expect(wrapper.find('input').attributes('aria-activedescendant')).toBe(options[2])
  })

  it('marks only the active option as selected', async () => {
    const wrapper = mountSelect()
    keydown(wrapper, 'ArrowDown')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="option"]').map((o) => o.attributes('aria-selected'))).toEqual(['true', 'false', 'false'])
  })

  it('selects the active option on Enter and claims the key', async () => {
    const wrapper = mountSelect()
    keydown(wrapper, 'ArrowDown')
    await wrapper.vm.$nextTick()
    const event = keydown(wrapper, 'Enter')

    expect(wrapper.emitted('select')?.at(-1)).toEqual(['serendipity'])
    expect(event.defaultPrevented).toBe(true)
  })

  // The Dictionary field sits in a form. With nothing highlighted, Enter must reach
  // the form so the typed word is submitted rather than swallowed.
  it('leaves Enter alone when no option is active', () => {
    const wrapper = mountSelect()
    const event = keydown(wrapper, 'Enter')

    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('selects on click', async () => {
    const wrapper = mountSelect()
    await wrapper.findAll('[role="option"]')[1].trigger('click')

    expect(wrapper.emitted('select')?.at(-1)).toEqual(['serendipitous'])
  })

  it('clears the query on Escape', () => {
    const wrapper = mountSelect()
    keydown(wrapper, 'Escape')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })

  it('drops the highlight when the results change', async () => {
    const wrapper = mountSelect()
    keydown(wrapper, 'ArrowDown')
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ results: ['other'] })

    expect(wrapper.find('input').attributes('aria-activedescendant')).toBeUndefined()
  })
})
