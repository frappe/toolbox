import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ToolHistory from './ToolHistory.vue'

const entries = [
  { id: 'a', label: '1,000 USD → INR', value: '83,120.00 INR', timestamp: Date.now() },
  { id: 'b', label: '5 km → mi', value: '3.106 mi' },
]

describe('ToolHistory', () => {
  it('renders an empty state with configurable copy', () => {
    const wrapper = mount(ToolHistory, {
      props: { entries: [], emptyTitle: 'No conversions yet', emptyDescription: 'Convert to begin.' },
    })

    expect(wrapper.text()).toContain('No conversions yet')
    expect(wrapper.text()).toContain('Convert to begin.')
    expect(wrapper.find('[aria-label="Clear history"]').exists()).toBe(false)
  })

  it('lists entries and emits reuse, copy, remove, and clear', async () => {
    const wrapper = mount(ToolHistory, {
      props: { entries, copiedEntryId: '' },
    })

    await wrapper.get('[aria-label="Reuse 1,000 USD → INR"]').trigger('click')
    await wrapper.get('[aria-label="Copy result 3.106 mi"]').trigger('click')
    await wrapper.get('[aria-label="Delete 5 km → mi from history"]').trigger('click')
    await wrapper.get('[aria-label="Clear history"]').trigger('click')

    expect(wrapper.emitted('reuse')[0][0]).toMatchObject({ id: 'a' })
    expect(wrapper.emitted('copy')[0][0]).toMatchObject({ id: 'b' })
    expect(wrapper.emitted('remove')[0][0]).toBe('b')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('hides the reuse action and shows a relative timestamp when asked', () => {
    const wrapper = mount(ToolHistory, {
      props: { entries, showReuse: false },
    })

    expect(wrapper.find('[aria-label="Reuse 1,000 USD → INR"]').exists()).toBe(false)
    // The first entry carries a fresh timestamp, so its <time> reads "Just now".
    expect(wrapper.get('time').text()).toBe('Just now')
  })

  it('reflects the copied state on the matching entry', () => {
    const wrapper = mount(ToolHistory, {
      props: { entries, copiedEntryId: 'a' },
    })

    expect(wrapper.find('[aria-label="Copied result 83,120.00 INR"]').exists()).toBe(true)
  })
})
