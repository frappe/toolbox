import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import AllToolsView from './AllToolsView.vue'
import { tools } from '@/data/toolRegistry'

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: AllToolsView },
      ...tools.map((tool) => ({ path: tool.route, component: { template: '<div />' } })),
    ],
  })
  router.push('/')
  await router.isReady()
  return mount(AllToolsView, { global: { plugins: [router] } })
}

describe('AllToolsView', () => {
  it('renders every tool as a card that links to its route', async () => {
    const wrapper = await mountView()
    const cards = wrapper.findAll('[data-tool-card]')

    expect(cards).toHaveLength(tools.length)
    const hrefs = cards.map((card) => card.attributes('href'))
    for (const tool of tools) {
      expect(hrefs.some((href) => href?.endsWith(tool.route))).toBe(true)
      expect(wrapper.text()).toContain(tool.name)
    }
  })

  it('groups the cards under their category headings', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Calculate')
    expect(wrapper.text()).toContain('Convert')
    expect(wrapper.text()).toContain('India')
  })
})
