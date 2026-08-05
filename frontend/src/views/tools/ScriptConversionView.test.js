import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ScriptConversionView from '@/views/tools/ScriptConversionView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

async function mountView() {
  const wrapper = mount(ScriptConversionView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('ScriptConversionView', () => {
  it('records recent use and renders the converter', async () => {
    const wrapper = await mountView()
    expect(preferences.recordRecent).toHaveBeenCalledWith('script-conversion')
    expect(wrapper.text()).toContain('Script Conversion')
    expect(wrapper.find('#source-text').exists()).toBe(true)
    expect(wrapper.find('#target-text').exists()).toBe(true)
  })

  it('converts typed input into the target script', async () => {
    const wrapper = await mountView()
    // Defaults are ITRANS → Devanagari.
    await wrapper.find('#source-text').setValue('namaste')
    await flushPromises()
    expect(wrapper.find('#target-text').element.value).toBe('नमस्ते')
  })
})
