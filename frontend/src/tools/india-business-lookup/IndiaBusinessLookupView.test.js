import { mount } from '@vue/test-utils'
import { h } from 'vue'
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

// The PIN and IFSC searches are two tools on two routes rendered by this one view, so which of
// them it draws comes from the route rather than from a click.
const route = vi.hoisted(() => ({ meta: {}, path: '/pin-code-search' }))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useRoute: () => route,
}))

// The real RouterLink needs an injected router. This renders what it renders: an anchor whose
// href is `to`, with every other attribute passed through, so the assertions below still read
// the markup a visitor gets.
const RouterLink = {
  props: { to: { type: String, required: true } },
  setup(props, { attrs, slots }) {
    return () => h('a', { ...attrs, href: props.to }, slots.default?.())
  },
}

function mountAt(toolId) {
  route.meta = { toolId }
  return mount(IndiaBusinessLookupView, {
    attachTo: document.body,
    global: { stubs: { RouterLink } },
  })
}

describe('IndiaBusinessLookupView', () => {
  it('tracks recent use against the tool the route names', () => {
    mountAt('ifsc-code-search')
    expect(preferences.recordRecent).toHaveBeenCalledWith('ifsc-code-search')
  })

  it('draws the tool the route asks for, with its own heading', () => {
    const pin = mountAt('pin-code-search')
    expect(pin.find('h1').text()).toBe('PIN Code Search')
    expect(pin.text()).toContain('PIN code dataset is not available yet')

    const ifsc = mountAt('ifsc-code-search')
    expect(ifsc.find('h1').text()).toBe('IFSC Code Search')
    expect(ifsc.text()).toContain('IFSC dataset is not available yet')
  })

  it('lists no sibling on the page, because the sidebar already lists them', () => {
    const wrapper = mountAt('pin-code-search')

    expect(wrapper.findAll('nav a')).toHaveLength(0)
  })
})
