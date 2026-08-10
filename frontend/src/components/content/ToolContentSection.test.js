import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import ToolContentSection from './ToolContentSection.vue'

async function mountAt(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  router.push(path)
  await router.isReady()

  return mount(ToolContentSection, { global: { plugins: [router] } })
}

// The content of a route is a lazy chunk, so it arrives after the route does.
function settled(wrapper, check) {
  return vi.waitFor(() => check(wrapper.text()))
}

describe('the content below a tool', () => {
  it('shows the content of the tool that is open', async () => {
    const wrapper = await mountAt('/emi-calculator')

    await settled(wrapper, (text) => {
      expect(text).toContain('How it works')
      expect(text).toContain('Frequently asked questions')
    })
  })

  it('continues the heading hierarchy the page started', async () => {
    // The tool view owns the h1. Two of them on one page is the fault this content could add.
    const wrapper = await mountAt('/emi-calculator')
    await settled(wrapper, (text) => expect(text).toContain('How it works'))

    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.findAll('h2').length).toBeGreaterThan(1)
  })

  it('renders nothing for a tool whose content is not written yet', async () => {
    const wrapper = await mountAt('/pace-calculator')
    await settled(wrapper, (text) => expect(text).toBe(''))

    expect(wrapper.find('div').exists()).toBe(false)
  })

  it('renders nothing for a page that is not a tool', async () => {
    const wrapper = await mountAt('/settings')
    await settled(wrapper, (text) => expect(text).toBe(''))

    expect(wrapper.find('div').exists()).toBe(false)
  })

  it('replaces the content when the visitor moves to another tool', async () => {
    const wrapper = await mountAt('/emi-calculator')
    await settled(wrapper, (text) => expect(text).toContain('equated monthly instalment'))

    wrapper.vm.$router.push('/calculator')
    await settled(wrapper, (text) => {
      expect(text).toContain('The calculator reads a whole expression')
      expect(text).not.toContain('equated monthly instalment')
    })
  })
})
