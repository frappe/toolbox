import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ToolState from './ToolState.vue'

const baseProps = {
  title: 'Nothing here yet',
  message: 'Add an item to get started.',
}

const stateCases = [
  ['empty', 'status', 'lucide-inbox'],
  ['error', 'alert', 'lucide-triangle-alert'],
  ['disabled', 'status', 'lucide-shield-alert'],
  ['stale', 'status', 'lucide-clock-alert'],
  ['offline', 'status', 'lucide-wifi-off'],
]

describe('ToolState', () => {
  it.each(stateCases)('renders the %s state with its public semantics', (status, role, icon) => {
    const wrapper = mount(ToolState, { props: { ...baseProps, status } })
    const state = wrapper.get('section')
    const title = wrapper.get('h2')

    expect(state.attributes('role')).toBe(role)
    expect(state.attributes('aria-labelledby')).toBe(title.attributes('id'))
    expect(state.attributes('aria-live')).toBeUndefined()
    // The real Icon renders its lucide name as a class, so that is what is asserted.
    expect(wrapper.get(`.${icon}`).exists()).toBe(true)
    expect(wrapper.text()).toContain(baseProps.title)
    expect(wrapper.text()).toContain(baseProps.message)
  })

  it('announces loading progress politely without showing a state icon', () => {
    const wrapper = mount(ToolState, {
      props: { ...baseProps, status: 'loading' },
    })
    const state = wrapper.get('section')

    expect(state.attributes('role')).toBe('status')
    expect(state.attributes('aria-live')).toBe('polite')
    expect(wrapper.get('[data-loading-indicator]').exists()).toBe(true)
    expect(wrapper.find('[class*="lucide-"]').exists()).toBe(false)
  })

  it('omits provenance until details are provided', () => {
    const wrapper = mount(ToolState, { props: baseProps })

    expect(wrapper.find('dl').exists()).toBe(false)
  })

  it('shows provenance, cache age, and a custom detail', () => {
    const wrapper = mount(ToolState, {
      props: {
        ...baseProps,
        source: 'Reference provider',
        updatedAt: '31 July 2026, 16:00',
        cacheAge: '12 minutes',
        detailLabel: 'Dataset',
        detailValue: '2026.07',
      },
    })

    expect(detailPairs(wrapper)).toEqual([
      ['Source:', 'Reference provider'],
      ['Updated:', '31 July 2026, 16:00'],
      ['Cache age:', '12 minutes'],
      ['Dataset:', '2026.07'],
    ])
  })

  it('emits distinct primary and secondary actions', async () => {
    const wrapper = mount(ToolState, {
      props: {
        ...baseProps,
        actionLabel: 'Try again',
        secondaryActionLabel: 'Clear',
      },
    })
    const buttons = wrapper.findAll('button')

    expect(buttons.map((button) => button.text())).toEqual(['Try again', 'Clear'])
    expect(buttons[0].attributes('data-variant')).toBe('solid')
    expect(buttons[1].attributes('data-variant')).toBe('subtle')

    await buttons[0].trigger('click')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('action')).toHaveLength(1)
    expect(wrapper.emitted('secondary-action')).toHaveLength(1)
  })
})

function detailPairs(wrapper) {
  return wrapper.findAll('dl > div').map((detail) => [
    detail.get('dt').text(),
    detail.get('dd').text(),
  ])
}
