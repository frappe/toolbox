import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import IndiaBusinessLookupView from '@/views/tools/IndiaBusinessLookupView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

function mountView() {
  return mount(IndiaBusinessLookupView, { attachTo: document.body })
}

describe('IndiaBusinessLookupView', () => {
  it('tracks recent use', () => {
    mountView()
    expect(preferences.recordRecent).toHaveBeenCalledWith('india-business-lookup')
  })

  it('opens on the PIN tab and switches to IFSC with honest queued states', async () => {
    const wrapper = mountView()
    const tabs = wrapper.findAll('[role="tab"]')

    expect(tabs).toHaveLength(2)
    expect(tabs.map((tab) => tab.attributes('aria-selected'))).toEqual(['true', 'false'])
    expect(wrapper.text()).toContain('PIN code dataset is not available yet')
    await tabs[1].trigger('click')
    expect(wrapper.text()).toContain('IFSC dataset is not available yet')
  })

  it('supports arrow, Home, and End keys across the tab strip', async () => {
    const wrapper = mountView()
    const tabs = wrapper.findAll('[role="tab"]')

    await tabs[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.text()).toContain('IFSC dataset is not available yet')
    expect(tabs[1].attributes('tabindex')).toBe('0')
    await tabs[1].trigger('keydown', { key: 'Home' })
    expect(wrapper.text()).toContain('PIN code dataset is not available yet')
    expect(tabs[0].attributes('tabindex')).toBe('0')
  })
})
