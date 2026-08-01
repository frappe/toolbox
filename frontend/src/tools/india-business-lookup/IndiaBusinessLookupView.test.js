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
  it('tracks recent use, exposes Favourite, and always shows the limitation', async () => {
    const wrapper = mountView()

    expect(preferences.recordRecent).toHaveBeenCalledWith('india-business-lookup')
    await wrapper.findAll('button').find((button) => button.text() === 'Favourite').trigger('click')
    expect(preferences.toggleFavourite).toHaveBeenCalledWith('india-business-lookup')
    expect(wrapper.text()).toContain('Format validation does not confirm that the registration is active or belongs to the claimed entity.')
  })

  it('validates and parses a documented GSTIN without a server request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const wrapper = mountView()

    await wrapper.get('#gstin').setValue(' 09aaaup8175a 1zg ')

    expect(wrapper.text()).toContain('Structurally valid')
    expect(wrapper.text()).toContain('Uttar Pradesh (09)')
    expect(wrapper.text()).toContain('AAAUP8175A')
    expect(wrapper.text()).toContain('Valid (G)')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reports structure and checksum failures clearly', async () => {
    const wrapper = mountView()

    await wrapper.get('#gstin').setValue('00AAAUP8175A1Z0')

    expect(wrapper.text()).toContain('Invalid GSTIN format')
    expect(wrapper.text()).toContain('not a recognised GST state code')
    expect(wrapper.text()).toContain('checksum should be')
    expect(wrapper.get('#gstin').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#gstin-errors').attributes('role')).toBe('alert')
  })

  it('keeps PIN and IFSC tabs available with honest queued states', async () => {
    const wrapper = mountView()
    const tabs = wrapper.findAll('[role="tab"]')

    expect(tabs.map((tab) => tab.attributes('aria-selected'))).toEqual(['true', 'false', 'false'])
    await tabs[1].trigger('click')
    expect(wrapper.text()).toContain('PIN code dataset is not available yet')
    await tabs[2].trigger('click')
    expect(wrapper.text()).toContain('IFSC dataset is not available yet')
  })

  it('supports arrow, Home, and End keys across the tab strip', async () => {
    const wrapper = mountView()
    const tabs = wrapper.findAll('[role="tab"]')

    await tabs[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.text()).toContain('PIN code dataset is not available yet')
    expect(tabs[1].attributes('tabindex')).toBe('0')
    await tabs[1].trigger('keydown', { key: 'End' })
    expect(wrapper.text()).toContain('IFSC dataset is not available yet')
    await tabs[2].trigger('keydown', { key: 'Home' })
    expect(wrapper.get('#gstin')).toBeTruthy()
  })
})
