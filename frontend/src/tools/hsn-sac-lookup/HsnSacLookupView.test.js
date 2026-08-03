import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HsnSacLookupView from '@/views/tools/HsnSacLookupView.vue'

const api = vi.hoisted(() => ({ fetchHsnStatus: vi.fn(), searchHsn: vi.fn() }))
vi.mock('@/tools/hsn-sac-lookup/api', () => api)

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))
vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

const STATUS = {
  hsn: {
    version: '2024-06-25',
    sourceUpdatedAt: '2024-06-25',
    recordCount: 18687,
    source: { name: 'CBIC via India Compliance', url: 'https://example.test', attribution: 'CBIC GST classification', license: 'GPLv3' },
  },
}

describe('HsnSacLookupView', () => {
  beforeEach(() => {
    api.fetchHsnStatus.mockReset()
    api.searchHsn.mockReset()
  })

  it('shows the queued state when no release is active', async () => {
    api.fetchHsnStatus.mockResolvedValue({ hsn: null })
    const wrapper = mount(HsnSacLookupView, { attachTo: document.body })
    await flushPromises()

    expect(preferences.recordRecent).toHaveBeenCalledWith('hsn-sac-lookup')
    expect(wrapper.text()).toContain('HSN and SAC dataset is not available yet')
    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
  })

  it('searches the bundled dataset and shows results with an honest source line', async () => {
    api.fetchHsnStatus.mockResolvedValue(STATUS)
    api.searchHsn.mockResolvedValue({
      state: 'ready',
      results: [{ code: '8517', code_type: 'HSN', description: 'Telephone sets' }],
    })
    const wrapper = mount(HsnSacLookupView, { attachTo: document.body })
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('8517')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.searchHsn).toHaveBeenCalledWith('8517')
    expect(wrapper.text()).toContain('8517')
    expect(wrapper.text()).toContain('Telephone sets')
    expect(wrapper.text()).toContain('Source updated')
    expect(wrapper.text()).toContain('18,687 codes')
  })
})
