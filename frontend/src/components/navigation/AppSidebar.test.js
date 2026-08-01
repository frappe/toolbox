import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { toolCategories, tools } from '@/data/toolRegistry'
import AppSidebar from './AppSidebar.vue'

describe('AppSidebar', () => {
  it('keeps every category expanded and omits the Recent section', async () => {
    const wrapper = await mountSidebar()
    const headings = wrapper.findAll('h2').map((heading) => heading.text())

    expect(headings).toEqual(toolCategories.map((category) => category.name))
    expect(headings).not.toContain('Recent')

    for (const tool of tools) {
      const links = wrapper.findAll(`a[href="${tool.route}"]`)
      expect(links).toHaveLength(1)
      expect(links[0].text()).toContain(tool.name)
    }
  })
})

async function mountSidebar() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/all-tools', component: { template: '<div />' } },
      ...tools.map((tool) => ({ path: tool.route, component: { template: '<div />' } })),
    ],
  })
  await router.push('/')
  await router.isReady()

  return mount(AppSidebar, { global: { plugins: [router] } })
}
