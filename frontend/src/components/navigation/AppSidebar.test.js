import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { toolCategories, tools, toolsById } from '@/data/toolRegistry'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
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

  it('exposes a collapse toggle and hides labels when collapsed', async () => {
    const expanded = await mountSidebar({ collapsible: true, collapsed: false })
    const toggle = expanded.get('button[aria-label="Collapse sidebar"]')
    await toggle.trigger('click')
    expect(expanded.emitted('toggle-collapse')).toHaveLength(1)

    const collapsed = await mountSidebar({ collapsible: true, collapsed: true })
    // Section headings collapse to dividers, and tool links fall back to icon + aria-label.
    expect(collapsed.findAll('h2')).toHaveLength(0)
    expect(collapsed.get('button[aria-label="Expand sidebar"]').exists()).toBe(true)
    const calculator = toolsById.get('calculator')
    expect(collapsed.get(`a[href="${calculator.route}"]`).attributes('aria-label')).toBe(
      calculator.name,
    )
  })

  it('omits tools the user has hidden', async () => {
    const preferences = useToolboxPreferences()
    const weather = toolsById.get('weather')
    preferences.toggleHidden('weather')

    try {
      const wrapper = await mountSidebar()
      expect(wrapper.findAll(`a[href="${weather.route}"]`)).toHaveLength(0)
      expect(wrapper.findAll(`a[href="${toolsById.get('calculator').route}"]`).length).toBeGreaterThan(0)
    } finally {
      preferences.toggleHidden('weather')
    }
  })
})

async function mountSidebar(props = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/all-tools', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
      ...tools.map((tool) => ({ path: tool.route, component: { template: '<div />' } })),
    ],
  })
  await router.push('/')
  await router.isReady()

  return mount(AppSidebar, { props, global: { plugins: [router] } })
}
