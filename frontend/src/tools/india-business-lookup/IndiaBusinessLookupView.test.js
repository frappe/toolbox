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
    const tabs = wrapper.findAll('[data-slot="tab-button"]')

    expect(tabs).toHaveLength(2)
    expect(tabs.map((tab) => tab.attributes('data-state'))).toEqual(['checked', 'unchecked'])
    expect(wrapper.text()).toContain('PIN code dataset is not available yet')
    await tabs[1].trigger('click')
    expect(wrapper.text()).toContain('IFSC dataset is not available yet')
  })

  // Arrow-key navigation across the TabButtons strip is exercised in a real
  // browser by india-business-lookup.spec.js; reka's roving focus does not
  // drive reliably under jsdom.
})
